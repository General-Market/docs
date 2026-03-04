/**
 * Sell ITP via Arb bridge relay (backend-only, no browser).
 *
 * IMPORTANT: This test MUST run after 08-arb-bridge-buy.spec.ts.
 * It sells the BridgedITP acquired from the buy test — no pre-minting.
 * This ensures the full flow works: AP has real inventory from the buy,
 * and the bridge custody holds real L3 shares to burn during sell.
 *
 * Flow: placeSellOrderDirect on Arb ArbBridgeCustody
 *   → issuers detect CrossChainSellOrderCreated on Arb
 *   → relay to L3 Index (submit + batch + fill)
 *   → send USDC to user on Arb
 *
 * Verifies: Arb USDC increases by at least a minimum expected amount.
 */

import { test, expect } from '@playwright/test';
import {
  placeSellOrderDirect,
  getL3UserShares,
  getItpStateL3,
  erc20BalanceOf,
  pollUntil,
  startArbBlockMiner,
  BRIDGED_ITP,
  ARB_USDC,
} from '../helpers/backend-api';

const TEST_ADDRESS = '0xC0d3ca67da45613e7C5b2d55F09b00B3c99721f4';
const ITP_ID = '0x0000000000000000000000000000000000000000000000000000000000000001';

test.describe('Arb Bridge Sell', () => {
  test('sell ITP via Arb bridge — issuers relay to L3, USDC returned on Arb', async () => {
    test.setTimeout(360_000); // 6 min — bridge relay with prod-like cycle (1000ms) needs more time

    const stopMiner = startArbBlockMiner(1000);

    try {
      // 1. Check user has BridgedITP from previous buy test (no pre-minting!)
      const bridgedItpBalance = BigInt(await erc20BalanceOf(BRIDGED_ITP, TEST_ADDRESS));
      console.log(`BridgedITP balance before sell: ${bridgedItpBalance}`);

      if (bridgedItpBalance === 0n) {
        test.skip(true, 'No BridgedITP balance — buy test must run first (test 08)');
        return;
      }

      // Sell half of what we have (keep some for other tests if needed)
      const sellAmount = bridgedItpBalance / 2n;
      expect(sellAmount).toBeGreaterThan(0n);
      console.log(`Will sell ${sellAmount} BridgedITP (half of ${bridgedItpBalance})`);

      // 2. Get NAV to compute expected USDC return
      const state = await getItpStateL3(ITP_ID);
      // Expected USDC = sellAmount * NAV / 1e18, converted to 6 decimals (Arb USDC)
      // Use 50% of expected as minimum threshold (accounts for slippage, fees)
      const expectedUsdc6 = (sellAmount * state.nav) / (10n ** 18n) / (10n ** 12n); // 18 dec → 6 dec
      const minUsdcIncrease = expectedUsdc6 / 2n; // 50% threshold
      console.log(`NAV: ${state.nav}, expected USDC (6 dec): ~${expectedUsdc6}, min threshold: ${minUsdcIncrease}`);

      // 3. Record balances IMMEDIATELY before placing sell order
      const usdcBefore = BigInt(await erc20BalanceOf(ARB_USDC, TEST_ADDRESS));
      const bridgedItpBefore = BigInt(await erc20BalanceOf(BRIDGED_ITP, TEST_ADDRESS));

      // 4. Place sell order on Arb ArbBridgeCustody (limit price = 0 for market sell)
      const orderId = await placeSellOrderDirect(TEST_ADDRESS, ITP_ID, sellAmount, 0n);
      console.log(`Arb bridge sell order placed: orderId=${orderId}`);

      // 5. Wait for Arb USDC balance to increase by at least minUsdcIncrease
      //    This prevents false positives from other tests' balance changes
      const usdcAfter = await pollUntil(
        async () => BigInt(await erc20BalanceOf(ARB_USDC, TEST_ADDRESS)),
        (balance) => balance - usdcBefore >= minUsdcIncrease,
        240_000,
        3_000,
      );
      const usdcGain = usdcAfter - usdcBefore;
      console.log(`Arb USDC received: ${usdcBefore} → ${usdcAfter} (gain: ${usdcGain})`);
      expect(usdcGain).toBeGreaterThanOrEqual(minUsdcIncrease);

      // 6. Verify BridgedITP was burned (decreased by sellAmount)
      const bridgedItpAfter = BigInt(await erc20BalanceOf(BRIDGED_ITP, TEST_ADDRESS));
      console.log(`BridgedITP: ${bridgedItpBefore} → ${bridgedItpAfter}`);
      expect(bridgedItpAfter).toBeLessThan(bridgedItpBefore);

      // 7. L3 shares: cross-chain sell burns bridge custody's shares, not user's
      const l3SharesAfter = await getL3UserShares(TEST_ADDRESS, ITP_ID);
      console.log(`L3 shares after sell: ${l3SharesAfter}`);
    } finally {
      stopMiner();
    }
  });
});
