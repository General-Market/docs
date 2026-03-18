/**
 * Multi-ITP Order Processing E2E Tests
 *
 * Verifies that buy/sell orders work for ITP2 (not just ITP1).
 * Tests the multi-ITP issuer fix (per-order itp_id + per-ITP NAV cache)
 * and the sell fills race condition fix (has_any_active_bridge_orders guard).
 *
 * Uses L3 direct path (no Settlement bridge needed) to avoid Settlement gas issues.
 */
import { test, expect, TEST_ADDRESS } from '../fixtures/wallet';
import {
  getItpCountL3,
  getItpStateL3,
  getL3UserShares,
  mintL3Shares,
  mintL3Usdc,
  placeL3BuyOrderDirect,
  placeL3SellOrderDirect,
  pollUntil,
  startSettlementBlockMiner,
} from '../helpers/backend-api';

// Read Index contract address from deployment.json
const INDEX_CONTRACT = (() => {
  try {
    const { readFileSync } = require('fs');
    const { join } = require('path');
    const path = join(__dirname, '..', '..', '..', 'deployments', 'active-deployment.json');
    return JSON.parse(readFileSync(path, 'utf-8')).contracts.Index;
  } catch {
    return '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6';
  }
})();

/** Build the bytes32 ITP ID from a number (1-indexed) */
function itpIdFromNumber(n: number): string {
  return '0x' + n.toString(16).padStart(64, '0');
}

import { IS_ANVIL } from '../env';

test.describe('Multi-ITP Order Processing', () => {
  test('buy ITP2 order fills via issuer consensus', async () => {
    test.setTimeout(240_000);

    // 1. Verify ITP2 exists
    const itpCount = await getItpCountL3();
    expect(itpCount, 'Need at least 2 ITPs on L3').toBeGreaterThanOrEqual(2);

    const itp2Id = itpIdFromNumber(2);

    // 2. Verify ITP2 has assets (fully initialized)
    const state = await getItpStateL3(itp2Id);
    expect(state.assets.length, 'ITP2 should have assets').toBeGreaterThan(0);

    // 3. Record shares before buy
    const sharesBefore = await getL3UserShares(TEST_ADDRESS, itp2Id);

    // 4. Always use L3 direct path (avoids Settlement gas issues)
    const usdcAmount = 100n * 10n ** 18n;
    const limitPrice = 10n * 10n ** 18n;
    const orderId = await placeL3BuyOrderDirect(TEST_ADDRESS, itp2Id, usdcAmount, limitPrice);
    console.log(`Placed ITP2 L3 buy order #${orderId}`);

    const sharesAfter = await pollUntil(
      () => getL3UserShares(TEST_ADDRESS, itp2Id),
      (shares) => shares > sharesBefore,
      180_000,
      3_000,
    );
    console.log(`ITP2 L3 buy order #${orderId} filled — shares: ${sharesBefore} -> ${sharesAfter}`);
    expect(sharesAfter).toBeGreaterThan(sharesBefore);
  });

  test('sell ITP2 order completes (not stuck at Executing trades)', async () => {
    test.setTimeout(240_000);

    // 1. Verify ITP2 exists
    const itpCount = await getItpCountL3();
    expect(itpCount, 'Need at least 2 ITPs on L3').toBeGreaterThanOrEqual(2);

    const itp2Id = itpIdFromNumber(2);

    // 2. Ensure user has L3 shares for ITP2
    const sharesBefore = await getL3UserShares(TEST_ADDRESS, itp2Id);
    if (sharesBefore < 50n * 10n ** 18n) {
      if (!IS_ANVIL) {
        console.log('Insufficient ITP2 shares — placing L3 buy order...');
        const usdcAmt = 200n * 10n ** 18n;
        await placeL3BuyOrderDirect(TEST_ADDRESS, itp2Id, usdcAmt, 10n * 10n ** 18n);
        const newShares = await pollUntil(
          () => getL3UserShares(TEST_ADDRESS, itp2Id),
          (s) => s >= 50n * 10n ** 18n,
          180_000,
          3_000,
        );
        console.log(`ITP2 buy filled — shares: ${newShares}`);
      } else {
        await mintL3Shares(TEST_ADDRESS, itp2Id, 100n * 10n ** 18n);
      }
    }

    // 3. Fund L3 Index with USDC so sell payouts don't fail
    await mintL3Usdc(INDEX_CONTRACT, 200n * 10n ** 18n);

    // 4. Record L3 shares before sell
    const l3SharesBefore = await getL3UserShares(TEST_ADDRESS, itp2Id);
    console.log(`ITP2 L3 shares before sell: ${l3SharesBefore}`);

    // 5. Start Settlement block miner (issuers need blocks for confirmation)
    const stopMiner = startSettlementBlockMiner(1000);

    try {
      // 6. Place L3 sell order for ITP2
      const sellAmount = l3SharesBefore > 50n * 10n ** 18n ? 50n * 10n ** 18n : l3SharesBefore;
      const limitPrice = 1n;
      const orderId = await placeL3SellOrderDirect(TEST_ADDRESS, itp2Id, sellAmount, limitPrice);
      console.log(`Placed ITP2 L3 sell order #${orderId}`);

      // 7. Wait for L3 shares to decrease
      const sharesAfter = await pollUntil(
        () => getL3UserShares(TEST_ADDRESS, itp2Id),
        (shares) => shares < l3SharesBefore,
        180_000,
        3_000,
      );
      console.log(`ITP2 sell order #${orderId} filled — L3 shares: ${l3SharesBefore} -> ${sharesAfter}`);
      expect(sharesAfter).toBeLessThan(l3SharesBefore);
    } finally {
      stopMiner();
    }
  });

  test('ITP1 sell still works after multi-ITP fix', async () => {
    test.setTimeout(240_000);

    const itp1Id = '0x0000000000000000000000000000000000000000000000000000000000000001';

    // Ensure user has L3 shares for ITP1
    let sharesBefore = await getL3UserShares(TEST_ADDRESS, itp1Id);
    if (sharesBefore < 25n * 10n ** 18n) {
      if (!IS_ANVIL) {
        console.log('Insufficient ITP1 shares — placing L3 buy order...');
        await placeL3BuyOrderDirect(TEST_ADDRESS, itp1Id, 200n * 10n ** 18n, 10n * 10n ** 18n);
        await pollUntil(
          () => getL3UserShares(TEST_ADDRESS, itp1Id),
          (s) => s >= 25n * 10n ** 18n,
          180_000,
          3_000,
        );
      } else {
        await mintL3Shares(TEST_ADDRESS, itp1Id, 100n * 10n ** 18n);
      }
    }

    // Fund L3 Index with USDC so sell payouts don't fail
    await mintL3Usdc(INDEX_CONTRACT, 200n * 10n ** 18n);

    // L3 direct sell path
    const l3SharesBefore = await getL3UserShares(TEST_ADDRESS, itp1Id);
    console.log(`ITP1 L3 shares before sell: ${l3SharesBefore}`);

    const sellAmount = l3SharesBefore > 25n * 10n ** 18n ? 25n * 10n ** 18n : l3SharesBefore;
    const limitPrice = 1n;
    const orderId = await placeL3SellOrderDirect(TEST_ADDRESS, itp1Id, sellAmount, limitPrice);
    console.log(`Placed ITP1 L3 sell order #${orderId}`);

    const sharesAfter = await pollUntil(
      () => getL3UserShares(TEST_ADDRESS, itp1Id),
      (shares) => shares < l3SharesBefore,
      180_000,
      3_000,
    );
    console.log(`ITP1 L3 sell order #${orderId} filled — L3 shares: ${l3SharesBefore} -> ${sharesAfter}`);
    expect(sharesAfter).toBeLessThan(l3SharesBefore);
  });
});
