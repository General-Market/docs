// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/libraries/DecimalLib.sol";

/// @title DecimalLibTest
/// @notice Tests for DecimalLib USDC decimal conversion library
contract DecimalLibTest is Test {
    // ============ CONSTANTS ============

    uint256 constant USDC_100 = 100_000_000; // 100 USDC in 6 decimals
    uint256 constant INTERNAL_100 = 100_000_000_000_000_000_000; // 100 in 18 decimals

    // ============ toInternal TESTS ============

    function test_toInternal_zeroAmount() public pure {
        assertEq(DecimalLib.toInternal(0), 0);
    }

    function test_toInternal_oneUsdc() public pure {
        // 1 USDC = 1_000_000 (6 dec) → 1_000_000_000_000_000_000 (18 dec)
        assertEq(DecimalLib.toInternal(1_000_000), 1e18);
    }

    function test_toInternal_100Usdc() public pure {
        assertEq(DecimalLib.toInternal(USDC_100), INTERNAL_100);
    }

    function test_toInternal_fractionalUsdc() public pure {
        // 0.001 USDC = 1000 (6 dec) → 1_000_000_000_000_000 (18 dec) = 0.001 * 1e18
        assertEq(DecimalLib.toInternal(1000), 1e15);
    }

    function test_toInternal_smallestUsdc() public pure {
        // Smallest USDC unit = 1 (0.000001 USDC) → 1e12 in 18 dec
        assertEq(DecimalLib.toInternal(1), 1e12);
    }

    function test_toInternal_largeAmount() public pure {
        // 1 billion USDC = 1e15 (6 dec) → 1e27 (18 dec)
        assertEq(DecimalLib.toInternal(1e15), 1e27);
    }

    function test_toInternal_maxSafeUsdc() public pure {
        // Max safe USDC without overflow when multiplied by 1e12
        // uint256 max / 1e12 = ~1.15e65, so max USDC is well within bounds
        uint256 maxUsdcSupply = 100_000_000_000 * 1e6; // 100B USDC (more than total supply)
        uint256 expected = 100_000_000_000 * 1e18;
        assertEq(DecimalLib.toInternal(maxUsdcSupply), expected);
    }

    // ============ toUsdc TESTS ============

    function test_toUsdc_zeroAmount() public pure {
        assertEq(DecimalLib.toUsdc(0), 0);
    }

    function test_toUsdc_oneUsdcInternal() public pure {
        // 1 USDC = 1e18 (18 dec) → 1_000_000 (6 dec)
        assertEq(DecimalLib.toUsdc(1e18), 1_000_000);
    }

    function test_toUsdc_100UsdcInternal() public pure {
        assertEq(DecimalLib.toUsdc(INTERNAL_100), USDC_100);
    }

    function test_toUsdc_truncatesDust() public pure {
        // 100 USDC + 999,999,999,999 wei dust
        uint256 withDust = INTERNAL_100 + 999_999_999_999;
        assertEq(DecimalLib.toUsdc(withDust), USDC_100);
    }

    function test_toUsdc_smallestConvertible() public pure {
        // 1e12 internal = 1 USDC unit (0.000001 USDC)
        assertEq(DecimalLib.toUsdc(1e12), 1);
    }

    function test_toUsdc_belowMinimum() public pure {
        // Amounts below 1e12 convert to 0
        assertEq(DecimalLib.toUsdc(1e12 - 1), 0);
        assertEq(DecimalLib.toUsdc(1), 0);
        assertEq(DecimalLib.toUsdc(999_999_999_999), 0);
    }

    // ============ hasDust TESTS ============

    function test_hasDust_noDust() public pure {
        assertFalse(DecimalLib.hasDust(0));
        assertFalse(DecimalLib.hasDust(1e12));
        assertFalse(DecimalLib.hasDust(1e18));
        assertFalse(DecimalLib.hasDust(INTERNAL_100));
    }

    function test_hasDust_withDust() public pure {
        assertTrue(DecimalLib.hasDust(1));
        assertTrue(DecimalLib.hasDust(1e12 - 1));
        assertTrue(DecimalLib.hasDust(1e12 + 1));
        assertTrue(DecimalLib.hasDust(INTERNAL_100 + 1));
        assertTrue(DecimalLib.hasDust(INTERNAL_100 + 999_999_999_999));
    }

    function test_hasDust_maxDust() public pure {
        // Max dust is 1e12 - 1 = 999,999,999,999 wei
        assertTrue(DecimalLib.hasDust(999_999_999_999));
    }

    // ============ getDust TESTS ============

    function test_getDust_noDust() public pure {
        assertEq(DecimalLib.getDust(0), 0);
        assertEq(DecimalLib.getDust(1e12), 0);
        assertEq(DecimalLib.getDust(1e18), 0);
    }

    function test_getDust_withDust() public pure {
        assertEq(DecimalLib.getDust(1), 1);
        assertEq(DecimalLib.getDust(1e12 + 123), 123);
        assertEq(DecimalLib.getDust(INTERNAL_100 + 999_999_999_999), 999_999_999_999);
    }

    function test_getDust_maxDust() public pure {
        assertEq(DecimalLib.getDust(1e12 - 1), 1e12 - 1);
    }

    // ============ roundTripLossless TESTS ============

    function test_roundTripLossless_various() public pure {
        assertTrue(DecimalLib.roundTripLossless(0));
        assertTrue(DecimalLib.roundTripLossless(1));
        assertTrue(DecimalLib.roundTripLossless(1_000_000));
        assertTrue(DecimalLib.roundTripLossless(USDC_100));
        assertTrue(DecimalLib.roundTripLossless(type(uint128).max));
    }

    // ============ FUZZ TESTS ============

    function testFuzz_roundTrip(uint128 usdc6) public pure {
        // Round-trip: 6 dec → 18 dec → 6 dec should be lossless
        uint256 internal18 = DecimalLib.toInternal(usdc6);
        uint256 backToUsdc = DecimalLib.toUsdc(internal18);
        assertEq(backToUsdc, usdc6);
    }

    function testFuzz_hasDust_consistency(uint256 internal18) public pure {
        bool hasDust = DecimalLib.hasDust(internal18);
        uint256 dust = DecimalLib.getDust(internal18);

        if (hasDust) {
            assertTrue(dust > 0);
            assertTrue(dust < 1e12);
        } else {
            assertEq(dust, 0);
        }
    }

    function testFuzz_toInternal_multiplier(uint128 usdc6) public pure {
        uint256 internal18 = DecimalLib.toInternal(usdc6);
        assertEq(internal18, uint256(usdc6) * 1e12);
    }

    function testFuzz_toUsdc_divider(uint256 internal18) public pure {
        uint256 usdc6 = DecimalLib.toUsdc(internal18);
        assertEq(usdc6, internal18 / 1e12);
    }

    // ============ EDGE CASES ============

    function test_constants() public pure {
        assertEq(DecimalLib.USDC_DECIMALS, 6);
        assertEq(DecimalLib.INTERNAL_DECIMALS, 18);
        assertEq(DecimalLib.DECIMAL_MULTIPLIER, 1e12);
    }

    function test_realWorldScenario_userDeposit() public pure {
        // User deposits 1000 USDC on Settlement
        uint256 userDeposit6dec = 1000 * 1e6; // 1,000,000,000

        // Contract converts to internal representation
        uint256 internal18dec = DecimalLib.toInternal(userDeposit6dec);
        assertEq(internal18dec, 1000 * 1e18); // 1,000,000,000,000,000,000,000

        // Later, user withdraws - convert back to USDC
        uint256 userReceives6dec = DecimalLib.toUsdc(internal18dec);
        assertEq(userReceives6dec, userDeposit6dec);
    }

    function test_realWorldScenario_dustLoss() public pure {
        // Internal amount with small dust (e.g., from fee calculation)
        uint256 internalWithDust = 1000 * 1e18 + 500_000_000_000; // 1000 USDC + 0.0000005 USDC worth

        // Check dust exists
        assertTrue(DecimalLib.hasDust(internalWithDust));
        assertEq(DecimalLib.getDust(internalWithDust), 500_000_000_000);

        // Convert - dust is truncated
        uint256 usdc6 = DecimalLib.toUsdc(internalWithDust);
        assertEq(usdc6, 1000 * 1e6); // Exactly 1000 USDC, dust lost
    }
}
