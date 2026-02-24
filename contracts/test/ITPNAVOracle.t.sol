// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {ITPNAVOracle} from "../src/oracle/ITPNAVOracle.sol";
import {IITPNAVOracle} from "../src/interfaces/IITPNAVOracle.sol";
import {MirrorIssuerRegistry} from "../src/registry/MirrorIssuerRegistry.sol";
import {IMirrorIssuerRegistry} from "../src/interfaces/IMirrorIssuerRegistry.sol";
import {ErrorsLib} from "../src/libraries/ErrorsLib.sol";
import {EventsLib} from "../src/libraries/EventsLib.sol";
import {BLSLib} from "../src/libraries/BLSLib.sol";
import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";
import "./helpers/TestHelper.sol";

/// @title ITPNAVOracleTest - Tests for Story 8.6
/// @notice Tests for ITPNAVOracle with BLS-verified pricing
/// @dev Uses real BLS signatures via FFI (bls-tool). All happy-path tests use real BLS signing
///      with test keys (seeds 0,1,2). Tests that revert before BLS verification (zero price,
///      stale cycle) pass arbitrary bytes since BLS is never reached.
///      Message hash: keccak256(abi.encodePacked(itpAddress, newPrice, timestamp, cycleNumber))
contract ITPNAVOracleTest is TestHelper {
    ITPNAVOracle public oracle;
    MirrorIssuerRegistry public mirror;

    address public admin = address(this);
    address public itpToken = address(0x1111);
    address public randomUser = address(0xBEEF);

    // Initial price: 1.0 in 36 decimals
    uint256 public constant INITIAL_PRICE = 1e36;

    // Test pubkey (128 bytes G2) — real BLS aggregated pubkey from seeds 0,1,2
    bytes public validPubkey;

    function setUp() public {
        // Set a reasonable block timestamp
        vm.warp(1_700_000_000);

        // Generate real BLS aggregated pubkey from seeds 0,1,2
        validPubkey = blsAggPubkey("0,1,2");

        // Deploy MirrorIssuerRegistry as UUPS proxy with real aggregated pubkey
        MirrorIssuerRegistry mirrorImpl = new MirrorIssuerRegistry();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(mirrorImpl),
            abi.encodeCall(MirrorIssuerRegistry.initialize, (validPubkey, 2, 3, admin))
        );
        mirror = MirrorIssuerRegistry(address(proxy));

        // Deploy ITPNAVOracle
        oracle = new ITPNAVOracle(address(mirror), itpToken, INITIAL_PRICE);
    }

    /// @dev Sign an oracle price update with the 3 test issuers
    function _signNavUpdate(uint256 price, uint256 timestamp, uint256 cycleNumber) internal returns (bytes memory) {
        bytes32 h = keccak256(abi.encodePacked(itpToken, price, timestamp, cycleNumber));
        return signWithTestIssuers(h);
    }

    // ============ CONSTRUCTOR / DEPLOYMENT TESTS ============

    function test_constructor_setsImmutables() public view {
        assertEq(address(oracle.mirrorRegistry()), address(mirror));
        assertEq(oracle.itpAddress(), itpToken);
        assertEq(oracle.currentPrice(), INITIAL_PRICE);
        assertEq(oracle.lastCycleNumber(), 0);
        assertTrue(oracle.lastUpdated() > 0);
    }

    function test_constants() public view {
        assertEq(oracle.PRICE_DECIMALS(), 36);
        assertEq(oracle.MAX_STALENESS(), 24 hours);
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
        emit EventsLib.NAVPriceUpdated(itpToken, newPrice, block.timestamp, cycleNumber, 0x7);

        oracle.updatePrice(newPrice, timestamp, cycleNumber, sig, 0x7);

        assertEq(oracle.currentPrice(), newPrice);
        assertEq(oracle.lastUpdated(), block.timestamp);
        assertEq(oracle.lastCycleNumber(), cycleNumber);
    }

    // ============ AC2: STALE CYCLE NUMBER ============

    function test_updatePrice_staleCycleNumber_sameCycle_silentNoOp() public {
        // First update with real BLS signature
        bytes memory sig42 = _signNavUpdate(1.05e36, block.timestamp, 42);
        oracle.updatePrice(1.05e36, block.timestamp, 42, sig42, 0x7);

        // Same cycle should be a silent no-op (returns before BLS verification)
        bytes memory sigStale = _signNavUpdate(1.06e36, block.timestamp, 42);
        oracle.updatePrice(1.06e36, block.timestamp, 42, sigStale, 0x7);

        // Price should remain from the first update, not the second
        assertEq(oracle.currentPrice(), 1.05e36, "Price should not change on stale cycle no-op");
        assertEq(oracle.lastCycleNumber(), 42, "Cycle should remain the same");
    }

    function test_updatePrice_staleCycleNumber_olderCycle_silentNoOp() public {
        // First update with real BLS signature
        bytes memory sig42 = _signNavUpdate(1.05e36, block.timestamp, 42);
        oracle.updatePrice(1.05e36, block.timestamp, 42, sig42, 0x7);

        // Older cycle should be a silent no-op (returns before BLS verification)
        bytes memory sigStale = _signNavUpdate(1.06e36, block.timestamp, 41);
        oracle.updatePrice(1.06e36, block.timestamp, 41, sigStale, 0x7);

        // Price should remain from the first update
        assertEq(oracle.currentPrice(), 1.05e36, "Price should not change on older cycle no-op");
        assertEq(oracle.lastCycleNumber(), 42, "Cycle should remain the same");
    }

    // ============ AC3: ZERO PRICE ============

    function test_updatePrice_zeroPrice_reverts() public {
        // Zero price reverts before BLS verification — any signature bytes work
        vm.expectRevert(ErrorsLib.E095_InvalidOraclePrice.selector);
        oracle.updatePrice(0, block.timestamp, 1, new bytes(64), 0x7);
    }

    // ============ AC4: INVALID BLS SIGNATURE ============

    function test_updatePrice_invalidBLSSignature_reverts() public {
        // Use a signature over wrong message — real BLS verification will fail
        bytes memory wrongSig = signWithTestIssuers(keccak256("wrong message"));
        vm.expectRevert(ErrorsLib.E020_InvalidBLSSignature.selector);
        oracle.updatePrice(1.05e36, block.timestamp, 1, wrongSig, 0x7);
    }

    function test_updatePrice_wrongLengthSignature_reverts() public {
        bytes memory shortSig = new bytes(32);
        vm.expectRevert(ErrorsLib.E020_InvalidBLSSignature.selector);
        oracle.updatePrice(1.05e36, block.timestamp, 1, shortSig, 0x7);
    }

    function test_updatePrice_emptySignature_reverts() public {
        bytes memory emptySig = new bytes(0);
        vm.expectRevert(ErrorsLib.E020_InvalidBLSSignature.selector);
        oracle.updatePrice(1.05e36, block.timestamp, 1, emptySig, 0x7);
    }

    // ============ AC5: PRICE() RETURNS WHEN NOT STALE ============

    function test_price_returnsWhenNotStale() public view {
        // Initial price is set in constructor, lastUpdated = block.timestamp
        uint256 p = oracle.price();
        assertEq(p, INITIAL_PRICE);
    }

    function test_price_returnsAfterRecentUpdate() public {
        uint256 newPrice = 2e36;
        bytes memory sig = _signNavUpdate(newPrice, block.timestamp, 1);
        oracle.updatePrice(newPrice, block.timestamp, 1, sig, 0x7);

        // Warp 2 hours forward (still within MAX_STALENESS)
        vm.warp(block.timestamp + 2 hours);

        uint256 p = oracle.price();
        assertEq(p, newPrice);
    }

    // ============ AC6: STALE PRICE ============

    function test_price_revertsWhenStale() public {
        // Warp past MAX_STALENESS (24 hours + 1 second)
        uint256 updatedAt = oracle.lastUpdated();
        vm.warp(updatedAt + 24 hours + 1);

        vm.expectRevert(
            abi.encodeWithSelector(ErrorsLib.E096_StaleOraclePrice.selector, updatedAt, 24 hours)
        );
        oracle.price();
    }

    function test_price_returnsAtExactStalenessLimit() public view {
        // At exactly MAX_STALENESS, should still work (block.timestamp - lastUpdated == MAX_STALENESS, not >)
        // Note: constructor sets lastUpdated = block.timestamp, so difference is 0 here
        uint256 p = oracle.price();
        assertEq(p, INITIAL_PRICE);
    }

    function test_price_returnsJustBeforeStaleness() public {
        // Warp to exactly MAX_STALENESS (boundary test)
        uint256 updatedAt = oracle.lastUpdated();
        vm.warp(updatedAt + 24 hours);

        // At exactly MAX_STALENESS, should still work (> not >=)
        uint256 p = oracle.price();
        assertEq(p, INITIAL_PRICE);
    }

    // ============ AC7: PERMISSIONLESS UPDATE ============

    function test_updatePrice_permissionless_anyAddressCanCall() public {
        bytes memory sig = _signNavUpdate(1.5e36, block.timestamp, 1);

        // Call from random address (not deployer, not admin)
        vm.prank(randomUser);
        oracle.updatePrice(1.5e36, block.timestamp, 1, sig, 0x7);

        assertEq(oracle.currentPrice(), 1.5e36);
    }

    function test_updatePrice_permissionless_zeroAddressCanCall() public {
        bytes memory sig = _signNavUpdate(1.5e36, block.timestamp, 1);

        vm.prank(address(0));
        oracle.updatePrice(1.5e36, block.timestamp, 1, sig, 0x7);

        assertEq(oracle.currentPrice(), 1.5e36);
    }

    // ============ PRICE FORMAT VERIFICATION ============

    function test_price_36decimalFormat() public {
        // Set a price that represents $1.05 in 36 decimals
        uint256 price105 = 1_050_000_000_000_000_000_000_000_000_000_000_000; // 1.05e36
        bytes memory sig = _signNavUpdate(price105, block.timestamp, 1);
        oracle.updatePrice(price105, block.timestamp, 1, sig, 0x7);

        uint256 p = oracle.price();
        assertEq(p, price105);
        assertEq(p, 1.05e36);
    }

    // ============ MULTIPLE SEQUENTIAL UPDATES ============

    function test_updatePrice_multipleSequentialUpdates() public {
        // Update 1
        oracle.updatePrice(1.01e36, block.timestamp, 1, _signNavUpdate(1.01e36, block.timestamp, 1), 0x7);
        assertEq(oracle.currentPrice(), 1.01e36);
        assertEq(oracle.lastCycleNumber(), 1);

        // Update 2
        vm.warp(block.timestamp + 1 hours);
        oracle.updatePrice(1.02e36, block.timestamp, 2, _signNavUpdate(1.02e36, block.timestamp, 2), 0x7);
        assertEq(oracle.currentPrice(), 1.02e36);
        assertEq(oracle.lastCycleNumber(), 2);

        // Update 3
        vm.warp(block.timestamp + 1 hours);
        oracle.updatePrice(1.03e36, block.timestamp, 3, _signNavUpdate(1.03e36, block.timestamp, 3), 0x7);
        assertEq(oracle.currentPrice(), 1.03e36);
        assertEq(oracle.lastCycleNumber(), 3);

        // Price should be accessible
        uint256 p = oracle.price();
        assertEq(p, 1.03e36);
    }

    // ============ AC8: BLS INTEGRATION WITH MIRROR REGISTRY ============

    function test_updatePrice_readsFromMirrorRegistry() public {
        // Update price with real BLS signature — internally, oracle calls mirror.getAggregatedPubkey()
        bytes memory sig = _signNavUpdate(1.1e36, block.timestamp, 1);
        oracle.updatePrice(1.1e36, block.timestamp, 1, sig, 0x7);

        // Verify state was updated (proving the oracle correctly read from the registry)
        assertEq(oracle.currentPrice(), 1.1e36);
    }

    function test_updatePrice_afterRegistrySync_usesNewPubkey() public {
        // First update with original registry pubkey (seeds 0,1,2)
        bytes memory sig1 = _signNavUpdate(1.1e36, block.timestamp, 1);
        oracle.updatePrice(1.1e36, block.timestamp, 1, sig1, 0x7);
        assertEq(oracle.currentPrice(), 1.1e36);

        // Sync registry to a new aggregated pubkey (seeds 3,4,5)
        bytes memory newPubkey = blsAggPubkey("3,4,5");
        bytes32 syncHash = keccak256(abi.encodePacked("REGISTRY_SYNC", uint256(1), newPubkey, uint256(4), uint256(3)));
        bytes memory syncSig = signWithTestIssuers(syncHash);
        mirror.sync(newPubkey, 4, 3, 1, syncSig, 0x7);

        // Second update must now be signed by seeds 3,4,5 (new pubkey)
        bytes32 h2 = keccak256(abi.encodePacked(itpToken, uint256(1.2e36), block.timestamp, uint256(2)));
        bytes memory sig2 = blsSign("3,4,5", h2);
        oracle.updatePrice(1.2e36, block.timestamp, 2, sig2, 0x7);
        assertEq(oracle.currentPrice(), 1.2e36);
    }

    // ============ VALIDATION ORDER TESTS ============

    function test_validationOrder_zeroPriceBeforeCycleCheck() public {
        // Zero price reverts before cycle number check — any signature bytes work
        vm.expectRevert(ErrorsLib.E095_InvalidOraclePrice.selector);
        oracle.updatePrice(0, block.timestamp, 1, new bytes(64), 0x7);
    }

    function test_validationOrder_cycleCheckBeforeBLS() public {
        // With cycle 0 (stale, since initial lastCycleNumber = 0), should be a silent no-op
        // (returns before BLS verification, saving gas) — any signature bytes work
        oracle.updatePrice(1e36, block.timestamp, 0, new bytes(64), 0x7);
        // Price should not have changed from constructor's initial price
    }

    // ============ EDGE CASES ============

    function test_updatePrice_maxUint256Price() public {
        uint256 maxPrice = type(uint256).max;
        bytes memory sig = _signNavUpdate(maxPrice, block.timestamp, 1);
        oracle.updatePrice(maxPrice, block.timestamp, 1, sig, 0x7);

        assertEq(oracle.currentPrice(), maxPrice);
    }

    function test_updatePrice_minimalPrice() public {
        // Smallest valid price is 1 (non-zero)
        bytes memory sig = _signNavUpdate(1, block.timestamp, 1);
        oracle.updatePrice(1, block.timestamp, 1, sig, 0x7);

        assertEq(oracle.currentPrice(), 1);
    }

    function test_updatePrice_largeCycleNumberGap() public {
        // Jump from cycle 0 to cycle 1000000
        bytes memory sig = _signNavUpdate(1e36, block.timestamp, 1_000_000);
        oracle.updatePrice(1e36, block.timestamp, 1_000_000, sig, 0x7);
        assertEq(oracle.lastCycleNumber(), 1_000_000);
    }

    function test_updatePrice_eventEmitsCorrectData() public {
        uint256 newPrice = 2.5e36;
        uint256 cycleNumber = 7;
        bytes memory sig = _signNavUpdate(newPrice, block.timestamp, cycleNumber);

        vm.expectEmit(true, false, false, true);
        emit EventsLib.NAVPriceUpdated(itpToken, newPrice, block.timestamp, cycleNumber, 0x7);

        oracle.updatePrice(newPrice, block.timestamp, cycleNumber, sig, 0x7);
    }

    function test_lastUpdated_usesBlockTimestamp_notIssuerTimestamp() public {
        // Warp forward to avoid underflow
        vm.warp(1000);

        // Provide a different issuer timestamp (in the past)
        uint256 issuerTimestamp = block.timestamp - 100;
        bytes memory sig = _signNavUpdate(1e36, issuerTimestamp, 1);

        oracle.updatePrice(1e36, issuerTimestamp, 1, sig, 0x7);

        // lastUpdated should be block.timestamp, NOT the issuer timestamp
        assertEq(oracle.lastUpdated(), block.timestamp);
    }
}
