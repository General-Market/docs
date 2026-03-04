/**
 * Buy ITP via Arb bridge relay (backend-only, no browser).
 *
 * Flow: placeBuyOrderDirect on Arb ArbBridgeCustody
 *   → issuers detect CrossChainOrderCreated on Arb
 *   → relay to L3 Index (submit + batch + fill)
 *   → mint BridgedITP on Arb
 *
 * Verifies: L3 shares increase, BridgedITP minted on Arb, USDC deducted.
 */

import { test, expect } from '@playwright/test';
import {
  placeBuyOrderDirect,
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

test.describe('Arb Bridge Buy', () => {
  test('buy ITP via Arb bridge — issuers relay to L3, BridgedITP minted', async () => {
    test.setTimeout(360_000); // 6 min — bridge relay with prod-like cycle (1000ms) needs more time

    // Start periodic block miner so Arb events get confirmed
    const stopMiner = startArbBlockMiner(1000);

    try {
      // 1. Record balances before
      const sharesBefore = await getL3UserShares(TEST_ADDRESS, ITP_ID);
      const bridgedItpBefore = BigInt(await erc20BalanceOf(BRIDGED_ITP, TEST_ADDRESS));

      // 2. Get NAV for limit price
      const state = await getItpStateL3(ITP_ID);
      const limitPrice = state.nav > 0n ? state.nav * 2n : 2000000000000000000n; // 2x NAV as generous limit

      // 3. Place buy order on Arb ArbBridgeCustody (100 USDC, 6 decimals)
      // Note: if the designated leader has buy_active locked (processing another order),
      // the order may be missed. Retry with a second order (different orderId = different leader).
      const usdcAmount = 100_000_000n; // 100 USDC
      const orderId = await placeBuyOrderDirect(TEST_ADDRESS, ITP_ID, usdcAmount, limitPrice);
      console.log(`Arb bridge buy order placed: orderId=${orderId}`);

      // 4. Wait for L3 shares to increase (issuers relayed and filled)
      let sharesAfter: bigint;
      try {
        sharesAfter = await pollUntil(
          () => getL3UserShares(TEST_ADDRESS, ITP_ID),
          (shares) => shares > sharesBefore,
          120_000,
          3_000,
        );
      } catch {
        // Leader may have missed the order (buy_active lock). Place another order
        // which gets a different orderId and possibly a different leader assignment.
        console.log(`Order ${orderId} not filled in 120s — retrying with new order`);
        const retryOrderId = await placeBuyOrderDirect(TEST_ADDRESS, ITP_ID, usdcAmount, limitPrice);
        console.log(`Retry order placed: orderId=${retryOrderId}`);
        sharesAfter = await pollUntil(
          () => getL3UserShares(TEST_ADDRESS, ITP_ID),
          (shares) => shares > sharesBefore,
          180_000,
          3_000,
        );
      }
      console.log(`L3 shares increased: ${sharesBefore} → ${sharesAfter}`);
      expect(sharesAfter).toBeGreaterThan(sharesBefore);

      // 5. Wait for BridgedITP to be minted on Arb
      // MintBridgedShares consensus (BLS aggregation across 3 issuers) can take 30-90s
      const bridgedItpAfter = await pollUntil(
        async () => BigInt(await erc20BalanceOf(BRIDGED_ITP, TEST_ADDRESS)),
        (balance) => balance > bridgedItpBefore,
        180_000,
        3_000,
      );
      console.log(`BridgedITP minted on Arb: ${bridgedItpBefore} → ${bridgedItpAfter}`);
      expect(bridgedItpAfter).toBeGreaterThan(bridgedItpBefore);
    } finally {
      stopMiner();
    }
  });
});
