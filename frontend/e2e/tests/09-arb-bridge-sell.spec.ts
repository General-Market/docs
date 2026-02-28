/**
 * Sell ITP via Arb bridge relay (backend-only, no browser).
 *
 * Flow: placeSellOrderDirect on Arb ArbBridgeCustody
 *   → issuers detect CrossChainSellOrderCreated on Arb
 *   → relay to L3 Index (submit + batch + fill)
 *   → send USDC to user on Arb
 *
 * Verifies: Arb USDC increases, BridgedITP burned, L3 shares decreased.
 */

import { test, expect } from '@playwright/test';
import {
  placeSellOrderDirect,
  mintBridgedItp,
  mintL3Shares,
  getL3UserShares,
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
    test.setTimeout(180_000);

    const stopMiner = startArbBlockMiner(1000);

    try {
      const sellAmount = 10n * 10n ** 18n; // 10 shares

      // 1. Mint BridgedITP to user on Arb (needed for sell approval)
      await mintBridgedItp(TEST_ADDRESS, ITP_ID, sellAmount);

      // 2. Mint L3 shares to user on L3 (needed for L3 fill to burn)
      await mintL3Shares(TEST_ADDRESS, ITP_ID, sellAmount);

      // 3. Record balances before
      const usdcBefore = BigInt(await erc20BalanceOf(ARB_USDC, TEST_ADDRESS));
      const bridgedItpBefore = BigInt(await erc20BalanceOf(BRIDGED_ITP, TEST_ADDRESS));
      const l3SharesBefore = await getL3UserShares(TEST_ADDRESS, ITP_ID);

      // 4. Place sell order on Arb ArbBridgeCustody (limit price = 0 for market sell)
      const orderId = await placeSellOrderDirect(TEST_ADDRESS, ITP_ID, sellAmount, 0n);
      console.log(`Arb bridge sell order placed: orderId=${orderId}`);

      // 5. Wait for Arb USDC balance to increase (issuers relayed, filled, sent USDC)
      const usdcAfter = await pollUntil(
        async () => BigInt(await erc20BalanceOf(ARB_USDC, TEST_ADDRESS)),
        (balance) => balance > usdcBefore,
        120_000,
        3_000,
      );
      console.log(`Arb USDC received: ${usdcBefore} → ${usdcAfter}`);
      expect(usdcAfter).toBeGreaterThan(usdcBefore);

      // 6. Verify BridgedITP was burned on Arb
      const bridgedItpAfter = BigInt(await erc20BalanceOf(BRIDGED_ITP, TEST_ADDRESS));
      console.log(`BridgedITP balance: ${bridgedItpBefore} → ${bridgedItpAfter}`);
      expect(bridgedItpAfter).toBeLessThan(bridgedItpBefore);

      // 7. Verify L3 shares decreased
      const l3SharesAfter = await getL3UserShares(TEST_ADDRESS, ITP_ID);
      console.log(`L3 shares: ${l3SharesBefore} → ${l3SharesAfter}`);
      expect(l3SharesAfter).toBeLessThan(l3SharesBefore);
    } finally {
      stopMiner();
    }
  });
});
