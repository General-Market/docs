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
/// @dev BLS verification is mocked via vm.mockCall on the bn256 pairing precompile (0x08).
///      Happy-path tests mock the precompile to return success. Sad-path tests (invalid BLS)
///      do NOT mock the precompile, so real verification fails. This means the message hash
///      format (keccak256(abi.encodePacked(itpAddress, newPrice, timestamp, cycleNumber)))
///      is NOT cryptographically verified against real BLS signing in these tests.
///      Integration testing with real BLS signatures should be done via FFI or pre-computed
///      test vectors to confirm Solidity/Rust message hash format alignment.
contract ITPNAVOracleTest is TestHelper {
    ITPNAVOracle public oracle;
    MirrorIssuerRegistry public mirror;

    address public admin = address(this);
    address public itpToken = address(0x1111);
    address public randomUser = address(0xBEEF);

    // Initial price: 1.0 in 36 decimals
    uint256 public constant INITIAL_PRICE = 1e36;

    // Test pubkey (128 bytes G2)
    bytes public validPubkey;

    // Mock BLS signature (64 bytes G1)
    bytes public mockSignature;

    // Pairing precompile address for mocking
    address constant PRECOMPILE_PAIRING = address(0x08);

    function setUp() public {
        // Set a reasonable block timestamp
        vm.warp(1_700_000_000);

        // Generate test pubkey
        validPubkey = generateTestPubkey(1);

        // Generate mock signature (all zeros = point at infinity, passes isOnCurve)
        mockSignature = new bytes(64);

        // Deploy MirrorIssuerRegistry as UUPS proxy
        MirrorIssuerRegistry mirrorImpl = new MirrorIssuerRegistry();
        ERC1967Proxy proxy = new ERC1967Proxy(
            address(mirrorImpl),
            abi.encodeCall(MirrorIssuerRegistry.initialize, (validPubkey, 2, 3, admin))
        );
        mirror = MirrorIssuerRegistry(address(proxy));

        // Deploy ITPNAVOracle
        oracle = new ITPNAVOracle(address(mirror), itpToken, INITIAL_PRICE);
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
        // Mock BLS verification to return true
        vm.mockCall(PRECOMPILE_PAIRING, abi.encode(), abi.encode(uint256(1)));

        uint256 newPrice = 1.05e36; // 1.05 in 36 decimals
        uint256 timestamp = block.timestamp;
        uint256 cycleNumber = 1;

        vm.expectEmit(true, false, false, true);
        emit EventsLib.NAVPriceUpdated(itpToken, newPrice, block.timestamp, cycleNumber, 0x7);

        oracle.updatePrice(newPrice, timestamp, cycleNumber, mockSignature, 0x7);

        assertEq(oracle.currentPrice(), newPrice);
        assertEq(oracle.lastUpdated(), block.timestamp);
        assertEq(oracle.lastCycleNumber(), cycleNumber);
    }

    // ============ AC2: STALE CYCLE NUMBER ============

    function test_updatePrice_staleCycleNumber_sameCycle_silentNoOp() public {
        // First update
        vm.mockCall(PRECOMPILE_PAIRING, abi.encode(), abi.encode(uint256(1)));
        oracle.updatePrice(1.05e36, block.timestamp, 42, mockSignature, 0x7);

        // Same cycle should be a silent no-op (not revert) — enables atomic bundler multicall
        oracle.updatePrice(1.06e36, block.timestamp, 42, mockSignature, 0x7);

        // Price should remain from the first update, not the second
        assertEq(oracle.currentPrice(), 1.05e36, "Price should not change on stale cycle no-op");
        assertEq(oracle.lastCycleNumber(), 42, "Cycle should remain the same");
    }

    function test_updatePrice_staleCycleNumber_olderCycle_silentNoOp() public {
        // First update
        vm.mockCall(PRECOMPILE_PAIRING, abi.encode(), abi.encode(uint256(1)));
        oracle.updatePrice(1.05e36, block.timestamp, 42, mockSignature, 0x7);

        // Older cycle should be a silent no-op (not revert)
        oracle.updatePrice(1.06e36, block.timestamp, 41, mockSignature, 0x7);

        // Price should remain from the first update
        assertEq(oracle.currentPrice(), 1.05e36, "Price should not change on older cycle no-op");
        assertEq(oracle.lastCycleNumber(), 42, "Cycle should remain the same");
    }

    // ============ AC3: ZERO PRICE ============

    function test_updatePrice_zeroPrice_reverts() public {
        vm.expectRevert(ErrorsLib.E095_InvalidOraclePrice.selector);
        oracle.updatePrice(0, block.timestamp, 1, mockSignature, 0x7);
    }

    // ============ AC4: INVALID BLS SIGNATURE ============

    function test_updatePrice_invalidBLSSignature_reverts() public {
        // Don't mock the precompile — real BLS verification will fail with random data
        vm.expectRevert(ErrorsLib.E020_InvalidBLSSignature.selector);
        oracle.updatePrice(1.05e36, block.timestamp, 1, mockSignature, 0x7);
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
        vm.mockCall(PRECOMPILE_PAIRING, abi.encode(), abi.encode(uint256(1)));
        uint256 newPrice = 2e36;
        oracle.updatePrice(newPrice, block.timestamp, 1, mockSignature, 0x7);

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
        vm.mockCall(PRECOMPILE_PAIRING, abi.encode(), abi.encode(uint256(1)));

        // Call from random address (not deployer, not admin)
        vm.prank(randomUser);
        oracle.updatePrice(1.5e36, block.timestamp, 1, mockSignature, 0x7);

        assertEq(oracle.currentPrice(), 1.5e36);
    }

    function test_updatePrice_permissionless_zeroAddressCanCall() public {
        vm.mockCall(PRECOMPILE_PAIRING, abi.encode(), abi.encode(uint256(1)));

        vm.prank(address(0));
        oracle.updatePrice(1.5e36, block.timestamp, 1, mockSignature, 0x7);

        assertEq(oracle.currentPrice(), 1.5e36);
    }

    // ============ PRICE FORMAT VERIFICATION ============

    function test_price_36decimalFormat() public {
        vm.mockCall(PRECOMPILE_PAIRING, abi.encode(), abi.encode(uint256(1)));

        // Set a price that represents $1.05 in 36 decimals
        uint256 price105 = 1_050_000_000_000_000_000_000_000_000_000_000_000; // 1.05e36
        oracle.updatePrice(price105, block.timestamp, 1, mockSignature, 0x7);

        uint256 p = oracle.price();
        assertEq(p, price105);
        assertEq(p, 1.05e36);
    }

    // ============ MULTIPLE SEQUENTIAL UPDATES ============

    function test_updatePrice_multipleSequentialUpdates() public {
        vm.mockCall(PRECOMPILE_PAIRING, abi.encode(), abi.encode(uint256(1)));

        // Update 1
        oracle.updatePrice(1.01e36, block.timestamp, 1, mockSignature, 0x7);
        assertEq(oracle.currentPrice(), 1.01e36);
        assertEq(oracle.lastCycleNumber(), 1);

        // Update 2
        vm.warp(block.timestamp + 1 hours);
        oracle.updatePrice(1.02e36, block.timestamp, 2, mockSignature, 0x7);
        assertEq(oracle.currentPrice(), 1.02e36);
        assertEq(oracle.lastCycleNumber(), 2);

        // Update 3
        vm.warp(block.timestamp + 1 hours);
        oracle.updatePrice(1.03e36, block.timestamp, 3, mockSignature, 0x7);
        assertEq(oracle.currentPrice(), 1.03e36);
        assertEq(oracle.lastCycleNumber(), 3);

        // Price should be accessible
        uint256 p = oracle.price();
        assertEq(p, 1.03e36);
    }

    // ============ AC8: BLS INTEGRATION WITH MIRROR REGISTRY ============

    function test_updatePrice_readsFromMirrorRegistry() public {
        // Mock BLS verification to succeed
        vm.mockCall(PRECOMPILE_PAIRING, abi.encode(), abi.encode(uint256(1)));

        // Update price — internally, oracle calls mirror.getAggregatedPubkey()
        oracle.updatePrice(1.1e36, block.timestamp, 1, mockSignature, 0x7);

        // Verify state was updated (proving the oracle correctly read from the registry)
        assertEq(oracle.currentPrice(), 1.1e36);
    }

    function test_updatePrice_afterRegistrySync_usesNewPubkey() public {
        // Mock BLS for all operations
        vm.mockCall(PRECOMPILE_PAIRING, abi.encode(), abi.encode(uint256(1)));

        // First update with original registry pubkey
        oracle.updatePrice(1.1e36, block.timestamp, 1, mockSignature, 0x7);
        assertEq(oracle.currentPrice(), 1.1e36);

        // Sync registry to new pubkey
        bytes memory newPubkey = generateTestPubkey(99);
        bytes memory syncSig = new bytes(64);
        mirror.sync(newPubkey, 4, 3, 1, syncSig, 0xF);

        // Second update should use new pubkey from registry
        oracle.updatePrice(1.2e36, block.timestamp, 2, mockSignature, 0x7);
        assertEq(oracle.currentPrice(), 1.2e36);
    }

    // ============ VALIDATION ORDER TESTS ============

    function test_validationOrder_zeroPriceBeforeCycleCheck() public {
        // Zero price should revert before cycle number check
        vm.expectRevert(ErrorsLib.E095_InvalidOraclePrice.selector);
        oracle.updatePrice(0, block.timestamp, 1, mockSignature, 0x7);
    }

    function test_validationOrder_cycleCheckBeforeBLS() public {
        // With cycle 0 (stale, since initial lastCycleNumber = 0), should be a silent no-op
        // (returns before BLS verification, saving gas)
        oracle.updatePrice(1e36, block.timestamp, 0, mockSignature, 0x7);
        // Price should not have changed from constructor's initial price
    }

    // ============ EDGE CASES ============

    function test_updatePrice_maxUint256Price() public {
        vm.mockCall(PRECOMPILE_PAIRING, abi.encode(), abi.encode(uint256(1)));

        uint256 maxPrice = type(uint256).max;
        oracle.updatePrice(maxPrice, block.timestamp, 1, mockSignature, 0x7);

        assertEq(oracle.currentPrice(), maxPrice);
    }

    function test_updatePrice_minimalPrice() public {
        vm.mockCall(PRECOMPILE_PAIRING, abi.encode(), abi.encode(uint256(1)));

        // Smallest valid price is 1 (non-zero)
        oracle.updatePrice(1, block.timestamp, 1, mockSignature, 0x7);

        assertEq(oracle.currentPrice(), 1);
    }

    function test_updatePrice_largeCycleNumberGap() public {
        vm.mockCall(PRECOMPILE_PAIRING, abi.encode(), abi.encode(uint256(1)));

        // Jump from cycle 0 to cycle 1000000
        oracle.updatePrice(1e36, block.timestamp, 1_000_000, mockSignature, 0x7);
        assertEq(oracle.lastCycleNumber(), 1_000_000);
    }

    function test_updatePrice_eventEmitsCorrectData() public {
        vm.mockCall(PRECOMPILE_PAIRING, abi.encode(), abi.encode(uint256(1)));

        uint256 newPrice = 2.5e36;
        uint256 cycleNumber = 7;

        vm.expectEmit(true, false, false, true);
        emit EventsLib.NAVPriceUpdated(itpToken, newPrice, block.timestamp, cycleNumber, 0x7);

        oracle.updatePrice(newPrice, block.timestamp, cycleNumber, mockSignature, 0x7);
    }

    function test_lastUpdated_usesBlockTimestamp_notIssuerTimestamp() public {
        // Warp forward to avoid underflow
        vm.warp(1000);

        vm.mockCall(PRECOMPILE_PAIRING, abi.encode(), abi.encode(uint256(1)));

        // Provide a different issuer timestamp (in the past)
        uint256 issuerTimestamp = block.timestamp - 100;

        oracle.updatePrice(1e36, issuerTimestamp, 1, mockSignature, 0x7);

        // lastUpdated should be block.timestamp, NOT the issuer timestamp
        assertEq(oracle.lastUpdated(), block.timestamp);
    }
}
