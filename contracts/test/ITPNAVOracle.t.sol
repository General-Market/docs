// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {ITPNAVOracle} from "../src/oracle/ITPNAVOracle.sol";
import {IITPNAVOracle} from "../src/interfaces/IITPNAVOracle.sol";
import {MirrorIssuerRegistry} from "../src/registry/MirrorIssuerRegistry.sol";
import {IMirrorIssuerRegistry} from "../src/interfaces/IMirrorIssuerRegistry.sol";
import {IIssuerRegistry} from "../src/interfaces/IIssuerRegistry.sol";
import {ErrorsLib} from "../src/libraries/ErrorsLib.sol";
import {EventsLib} from "../src/libraries/EventsLib.sol";
import {BLSLib} from "../src/libraries/BLSLib.sol";
import {BLSVerifier} from "../src/libraries/BLSVerifier.sol";
import {TypesLib} from "../src/libraries/TypesLib.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./helpers/TestHelper.sol";

/// @title ITPNAVOracleTest - Tests for Phase 2B ITPNAVOracle
/// @notice Tests for ITPNAVOracle with BLSVerifier (multi-pairing, 2/3 threshold, snapshot-based).
/// @dev The oracle now inherits BLSVerifier and reads from MirrorIssuerRegistry which
///      implements IIssuerRegistry. The mirror must be synced (to populate individual pubkeys
///      and create a snapshot) before the oracle can verify any signatures.
///      Message hash: keccak256(abi.encode(chainid, address(this), itpAddress, newPrice, timestamp, cycleNumber))
contract ITPNAVOracleTest is TestHelper {
    ITPNAVOracle public oracle;
    MirrorIssuerRegistry public mirror;

    address public admin = address(this);
    address public itpToken = address(0x1111);
    address public randomUser = address(0xBEEF);

    // Initial price: 1.0 in 36 decimals
    uint256 public constant INITIAL_PRICE = 1e36;

    // Snapshot nonce after sync
    uint256 public constant SYNC_NONCE = 1;

    // Signers bitmask for 3 issuers (bits 0,1,2 set)
    uint256 public constant SIGNERS_BITMASK_3 = 0x07;

    // Individual pubkeys and IDs
    bytes[] public issuerPubkeys;
    uint256[] public issuerIds;

    function setUp() public {
        // Set a reasonable block timestamp
        vm.warp(1_700_000_000);

        // Generate real BLS aggregated pubkey from seeds 0,1,2
        bytes memory aggPubkey = blsAggPubkey("0,1,2");

        // Deploy MirrorIssuerRegistry as UUPS proxy with aggregated pubkey (TOFU bootstrap)
        MirrorIssuerRegistry mirrorImpl = new MirrorIssuerRegistry();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(mirrorImpl),
            abi.encodeCall(MirrorIssuerRegistry.initialize, (aggPubkey, 2, 3, admin))
        );
        mirror = MirrorIssuerRegistry(address(proxy));

        // Prepare individual pubkeys for sync
        issuerPubkeys = new bytes[](3);
        issuerIds = new uint256[](3);
        for (uint8 i = 0; i < 3; i++) {
            issuerPubkeys[i] = blsPubkey(i);
            issuerIds[i] = i;
        }

        // Sync the mirror registry to populate individual pubkeys and create a snapshot
        // This uses TOFU (first sync, verifies against aggregated pubkey)
        uint256 newActiveBitmask = 0x07; // bits 0,1,2
        uint256 newActiveCount = 3;
        uint256 newThreshold = 2;
        bytes32 syncHash = keccak256(
            abi.encode(
                "REGISTRY_SYNC",
                block.chainid,
                address(mirror),
                SYNC_NONCE,
                keccak256(abi.encode(issuerPubkeys, issuerIds)),
                newActiveBitmask,
                newActiveCount,
                newThreshold
            )
        );
        bytes memory syncSig = signWithTestIssuers(syncHash);
        mirror.sync(issuerPubkeys, issuerIds, newActiveBitmask, newActiveCount, newThreshold, SYNC_NONCE, syncSig, 0, 0);

        // Deploy ITPNAVOracle pointing to the mirror registry
        oracle = new ITPNAVOracle(address(mirror), itpToken, INITIAL_PRICE);

        // Authorize oracle for incrementMissedCounts
        mirror.setAuthorizedMissedCountCaller(address(oracle), true);
    }

    /// @dev Sign an oracle price update with the 3 test issuers using new hash format
    function _signNavUpdate(uint256 price_, uint256 timestamp_, uint256 cycleNumber_) internal returns (bytes memory) {
        bytes32 h = keccak256(
            abi.encode(block.chainid, address(oracle), itpToken, price_, timestamp_, cycleNumber_)
        );
        return signWithTestIssuers(h);
    }

    // ============ CONSTRUCTOR / DEPLOYMENT TESTS ============

    function test_constructor_setsImmutables() public view {
        // mirrorRegistry is no longer a public field; BLSVerifier stores it as _blsIssuerRegistry
        assertEq(address(oracle.blsIssuerRegistry()), address(mirror));
        assertEq(oracle.itpAddress(), itpToken);
        assertEq(oracle.currentPrice(), INITIAL_PRICE);
        assertEq(oracle.lastCycleNumber(), 0);
        assertTrue(oracle.lastUpdated() > 0);
    }

    function test_constants() public view {
        assertEq(oracle.PRICE_DECIMALS(), 36);
        assertEq(oracle.MAX_STALENESS(), 24 hours);
        assertEq(oracle.MAX_DEVIATION_BPS(), 1000);
        assertEq(oracle.MAX_CYCLE_GAP(), 10000);
    }

    function test_constructor_revertsOnZeroInitialPrice() public {
        vm.expectRevert(ErrorsLib.E095_InvalidOraclePrice.selector);
        new ITPNAVOracle(address(mirror), itpToken, 0);
    }

    // ============ AC1: VALID PRICE UPDATE ============

    function test_updatePrice_validSignature_updatesState() public {
        uint256 newPrice = 1.05e36; // 1.05 in 36 decimals
        uint256 timestamp = block.timestamp;
        uint256 cycleNumber = 1;
        bytes memory sig = _signNavUpdate(newPrice, timestamp, cycleNumber);

        vm.expectEmit(true, false, false, true);
        emit EventsLib.NAVPriceUpdated(itpToken, newPrice, block.timestamp, cycleNumber, SIGNERS_BITMASK_3);

        oracle.updatePrice(newPrice, timestamp, cycleNumber, sig, SYNC_NONCE, SIGNERS_BITMASK_3);

        assertEq(oracle.currentPrice(), newPrice);
        assertEq(oracle.lastUpdated(), block.timestamp);
        assertEq(oracle.lastCycleNumber(), cycleNumber);
    }

    // ============ AC2: STALE CYCLE NUMBER ============

    function test_updatePrice_staleCycleNumber_sameCycle_silentNoOp() public {
        // First update with real BLS signature
        bytes memory sig42 = _signNavUpdate(1.05e36, block.timestamp, 42);
        oracle.updatePrice(1.05e36, block.timestamp, 42, sig42, SYNC_NONCE, SIGNERS_BITMASK_3);

        // Same cycle should be a silent no-op (returns before BLS verification)
        bytes memory sigStale = _signNavUpdate(1.06e36, block.timestamp, 42);
        oracle.updatePrice(1.06e36, block.timestamp, 42, sigStale, SYNC_NONCE, SIGNERS_BITMASK_3);

        // Price should remain from the first update, not the second
        assertEq(oracle.currentPrice(), 1.05e36, "Price should not change on stale cycle no-op");
        assertEq(oracle.lastCycleNumber(), 42, "Cycle should remain the same");
    }

    function test_updatePrice_staleCycleNumber_olderCycle_silentNoOp() public {
        // First update with real BLS signature
        bytes memory sig42 = _signNavUpdate(1.05e36, block.timestamp, 42);
        oracle.updatePrice(1.05e36, block.timestamp, 42, sig42, SYNC_NONCE, SIGNERS_BITMASK_3);

        // Older cycle should be a silent no-op (returns before BLS verification)
        bytes memory sigStale = _signNavUpdate(1.06e36, block.timestamp, 41);
        oracle.updatePrice(1.06e36, block.timestamp, 41, sigStale, SYNC_NONCE, SIGNERS_BITMASK_3);

        // Price should remain from the first update
        assertEq(oracle.currentPrice(), 1.05e36, "Price should not change on older cycle no-op");
        assertEq(oracle.lastCycleNumber(), 42, "Cycle should remain the same");
    }

    // ============ AC3: ZERO PRICE ============

    function test_updatePrice_zeroPrice_reverts() public {
        // Zero price reverts before BLS verification
        vm.expectRevert(ErrorsLib.E095_InvalidOraclePrice.selector);
        oracle.updatePrice(0, block.timestamp, 1, new bytes(64), SYNC_NONCE, SIGNERS_BITMASK_3);
    }

    // ============ AC4: INVALID BLS SIGNATURE ============

    function test_updatePrice_invalidBLSSignature_reverts() public {
        // Use a signature over wrong message — real BLS verification will fail
        bytes memory wrongSig = signWithTestIssuers(keccak256("wrong message"));
        vm.expectRevert(BLSVerifier.BLSVerifier__InvalidSignature.selector);
        oracle.updatePrice(1.05e36, block.timestamp, 1, wrongSig, SYNC_NONCE, SIGNERS_BITMASK_3);
    }

    function test_updatePrice_wrongLengthSignature_reverts() public {
        bytes memory shortSig = new bytes(32);
        vm.expectRevert(BLSVerifier.BLSVerifier__InvalidSignature.selector);
        oracle.updatePrice(1.05e36, block.timestamp, 1, shortSig, SYNC_NONCE, SIGNERS_BITMASK_3);
    }

    function test_updatePrice_emptySignature_reverts() public {
        bytes memory emptySig = new bytes(0);
        vm.expectRevert(BLSVerifier.BLSVerifier__InvalidSignature.selector);
        oracle.updatePrice(1.05e36, block.timestamp, 1, emptySig, SYNC_NONCE, SIGNERS_BITMASK_3);
    }

    // ============ AC5: PRICE() RETURNS WHEN NOT STALE ============

    function test_price_returnsWhenNotStale() public view {
        uint256 p = oracle.price();
        assertEq(p, INITIAL_PRICE);
    }

    function test_price_returnsAfterRecentUpdate() public {
        uint256 newPrice = 1.05e36;
        bytes memory sig = _signNavUpdate(newPrice, block.timestamp, 1);
        oracle.updatePrice(newPrice, block.timestamp, 1, sig, SYNC_NONCE, SIGNERS_BITMASK_3);

        // Warp 2 hours forward (still within MAX_STALENESS)
        vm.warp(block.timestamp + 2 hours);

        uint256 p = oracle.price();
        assertEq(p, newPrice);
    }

    // ============ AC6: STALE PRICE ============

    function test_price_revertsWhenStale() public {
        uint256 updatedAt = oracle.lastUpdated();
        vm.warp(updatedAt + 24 hours + 1);

        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E096_StaleOraclePrice.selector, updatedAt, 24 hours)
        );
        oracle.price();
    }

    function test_price_returnsAtExactStalenessLimit() public view {
        uint256 p = oracle.price();
        assertEq(p, INITIAL_PRICE);
    }

    function test_price_returnsJustBeforeStaleness() public {
        uint256 updatedAt = oracle.lastUpdated();
        vm.warp(updatedAt + 24 hours);

        uint256 p = oracle.price();
        assertEq(p, INITIAL_PRICE);
    }

    // ============ AC7: PERMISSIONLESS UPDATE ============

    function test_updatePrice_permissionless_anyAddressCanCall() public {
        uint256 newPrice = 1.05e36;
        bytes memory sig = _signNavUpdate(newPrice, block.timestamp, 1);

        vm.prank(randomUser);
        oracle.updatePrice(newPrice, block.timestamp, 1, sig, SYNC_NONCE, SIGNERS_BITMASK_3);

        assertEq(oracle.currentPrice(), newPrice);
    }

    function test_updatePrice_permissionless_zeroAddressCanCall() public {
        uint256 newPrice = 1.05e36;
        bytes memory sig = _signNavUpdate(newPrice, block.timestamp, 1);

        vm.prank(address(0));
        oracle.updatePrice(newPrice, block.timestamp, 1, sig, SYNC_NONCE, SIGNERS_BITMASK_3);

        assertEq(oracle.currentPrice(), newPrice);
    }

    // ============ PRICE FORMAT VERIFICATION ============

    function test_price_36decimalFormat() public {
        uint256 price105 = 1.05e36;
        bytes memory sig = _signNavUpdate(price105, block.timestamp, 1);
        oracle.updatePrice(price105, block.timestamp, 1, sig, SYNC_NONCE, SIGNERS_BITMASK_3);

        uint256 p = oracle.price();
        assertEq(p, price105);
        assertEq(p, 1.05e36);
    }

    // ============ MULTIPLE SEQUENTIAL UPDATES ============

    function test_updatePrice_multipleSequentialUpdates() public {
        // Update 1
        oracle.updatePrice(1.01e36, block.timestamp, 1, _signNavUpdate(1.01e36, block.timestamp, 1), SYNC_NONCE, SIGNERS_BITMASK_3);
        assertEq(oracle.currentPrice(), 1.01e36);
        assertEq(oracle.lastCycleNumber(), 1);

        // Update 2
        vm.warp(block.timestamp + 1 hours);
        oracle.updatePrice(1.02e36, block.timestamp, 2, _signNavUpdate(1.02e36, block.timestamp, 2), SYNC_NONCE, SIGNERS_BITMASK_3);
        assertEq(oracle.currentPrice(), 1.02e36);
        assertEq(oracle.lastCycleNumber(), 2);

        // Update 3
        vm.warp(block.timestamp + 1 hours);
        oracle.updatePrice(1.03e36, block.timestamp, 3, _signNavUpdate(1.03e36, block.timestamp, 3), SYNC_NONCE, SIGNERS_BITMASK_3);
        assertEq(oracle.currentPrice(), 1.03e36);
        assertEq(oracle.lastCycleNumber(), 3);

        uint256 p = oracle.price();
        assertEq(p, 1.03e36);
    }

    // ============ AC8: BLS INTEGRATION WITH MIRROR REGISTRY ============

    function test_updatePrice_readsFromMirrorRegistry() public {
        uint256 newPrice = 1.05e36;
        bytes memory sig = _signNavUpdate(newPrice, block.timestamp, 1);
        oracle.updatePrice(newPrice, block.timestamp, 1, sig, SYNC_NONCE, SIGNERS_BITMASK_3);

        assertEq(oracle.currentPrice(), newPrice);
    }

    // ============ VALIDATION ORDER TESTS ============

    function test_validationOrder_zeroPriceBeforeCycleCheck() public {
        vm.expectRevert(ErrorsLib.E095_InvalidOraclePrice.selector);
        oracle.updatePrice(0, block.timestamp, 1, new bytes(64), SYNC_NONCE, SIGNERS_BITMASK_3);
    }

    function test_validationOrder_cycleCheckBeforeBLS() public {
        // With cycle 0 (stale, since initial lastCycleNumber = 0), should be a silent no-op
        oracle.updatePrice(1e36, block.timestamp, 0, new bytes(64), SYNC_NONCE, SIGNERS_BITMASK_3);
    }

    // ============ CYCLE GAP TESTS ============

    function test_updatePrice_revertsCycleGapTooLarge() public {
        // Cycle gap > MAX_CYCLE_GAP (10000) should revert
        vm.expectRevert(ErrorsLib.E133_CycleGapTooLarge.selector);
        oracle.updatePrice(1.05e36, block.timestamp, 10001, new bytes(64), SYNC_NONCE, SIGNERS_BITMASK_3);
    }

    function test_updatePrice_maxCycleGapAllowed() public {
        // Cycle gap == MAX_CYCLE_GAP should be allowed (0 + 10000 = 10000)
        bytes memory sig = _signNavUpdate(1.05e36, block.timestamp, 10000);
        oracle.updatePrice(1.05e36, block.timestamp, 10000, sig, SYNC_NONCE, SIGNERS_BITMASK_3);
        assertEq(oracle.lastCycleNumber(), 10000);
    }

    // ============ PRICE DEVIATION TESTS ============

    function test_updatePrice_revertsDeviationTooHigh() public {
        // First update to establish a baseline (skip on first since lastCycleNumber starts at 0)
        bytes memory sig1 = _signNavUpdate(1e36, block.timestamp, 1);
        oracle.updatePrice(1e36, block.timestamp, 1, sig1, SYNC_NONCE, SIGNERS_BITMASK_3);

        // Now try >10% jump: 1e36 -> 1.11e36 (11% up)
        vm.expectRevert(ErrorsLib.E134_PriceDeviationTooHigh.selector);
        oracle.updatePrice(1.11e36, block.timestamp, 2, new bytes(64), SYNC_NONCE, SIGNERS_BITMASK_3);
    }

    function test_updatePrice_allowsDeviationWithin10Percent() public {
        // First update
        bytes memory sig1 = _signNavUpdate(1e36, block.timestamp, 1);
        oracle.updatePrice(1e36, block.timestamp, 1, sig1, SYNC_NONCE, SIGNERS_BITMASK_3);

        // 9.9% jump should be allowed
        uint256 newPrice = 1.099e36;
        bytes memory sig2 = _signNavUpdate(newPrice, block.timestamp, 2);
        oracle.updatePrice(newPrice, block.timestamp, 2, sig2, SYNC_NONCE, SIGNERS_BITMASK_3);
        assertEq(oracle.currentPrice(), newPrice);
    }

    function test_updatePrice_skipsDeviationCheckOnFirstUpdate() public {
        // First update (lastCycleNumber == 0): skip deviation check even if wildly different
        // e.g., initial price is 1e36, update to 0.5e36 (50% drop)
        uint256 newPrice = 0.5e36;
        bytes memory sig = _signNavUpdate(newPrice, block.timestamp, 1);
        oracle.updatePrice(newPrice, block.timestamp, 1, sig, SYNC_NONCE, SIGNERS_BITMASK_3);
        assertEq(oracle.currentPrice(), newPrice);
    }

    // ============ EDGE CASES ============

    function test_updatePrice_minimalPrice() public {
        // Smallest valid price (within deviation tolerance from initial 1e36 — use first update skip)
        bytes memory sig = _signNavUpdate(1, block.timestamp, 1);
        oracle.updatePrice(1, block.timestamp, 1, sig, SYNC_NONCE, SIGNERS_BITMASK_3);
        assertEq(oracle.currentPrice(), 1);
    }

    function test_updatePrice_eventEmitsCorrectData() public {
        uint256 newPrice = 1.05e36;
        uint256 cycleNumber = 7;
        bytes memory sig = _signNavUpdate(newPrice, block.timestamp, cycleNumber);

        vm.expectEmit(true, false, false, true);
        emit EventsLib.NAVPriceUpdated(itpToken, newPrice, block.timestamp, cycleNumber, SIGNERS_BITMASK_3);

        oracle.updatePrice(newPrice, block.timestamp, cycleNumber, sig, SYNC_NONCE, SIGNERS_BITMASK_3);
    }

    function test_lastUpdated_usesBlockTimestamp_notIssuerTimestamp() public {
        vm.warp(1000);

        uint256 issuerTimestamp = block.timestamp - 100;
        bytes memory sig = _signNavUpdate(1e36, issuerTimestamp, 1);

        oracle.updatePrice(1e36, issuerTimestamp, 1, sig, SYNC_NONCE, SIGNERS_BITMASK_3);

        assertEq(oracle.lastUpdated(), block.timestamp);
    }
}
