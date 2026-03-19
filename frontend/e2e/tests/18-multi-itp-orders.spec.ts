/**
 * Multi-ITP Order Processing E2E Tests
 *
 * Verifies that buy/sell orders work for multiple ITPs (not just the first one).
 * Tests the multi-ITP oracle fix (per-order itp_id + per-ITP NAV cache)
 * and the sell fills race condition fix (has_any_active_bridge_orders guard).
 *
 * Uses L3 direct path (no Settlement bridge needed) to avoid Settlement gas issues.
 * Discovers available ITPs dynamically — no hardcoded ITP IDs.
 */
import { test, expect, TEST_ADDRESS } from '../fixtures/wallet';
import {
  getAvailableItpIds,
  getItpStateL3,
  getL3UserShares,
  mintL3Usdc,
  placeL3BuyOrderDirect,
  placeL3SellOrderDirect,
  pollUntil,
} from '../helpers/backend-api';

import { CONTRACTS } from '../env';
const INDEX_CONTRACT = CONTRACTS.Index ?? '';

test.describe('Multi-ITP Order Processing', () => {
  test('buy second ITP order fills via oracle consensus', async () => {
    test.setTimeout(240_000);

    // 1. Discover available ITPs — need at least 2
    const itpIds = await getAvailableItpIds(3);
    if (itpIds.length < 2) {
      console.log(`Only ${itpIds.length} ITP(s) available — skipping multi-ITP buy test`);
      test.skip();
      return;
    }

    const itp2Id = itpIds[1]; // second available ITP
    console.log(`Multi-ITP buy: targeting ${itp2Id} (${itpIds.length} ITPs available)`);

    // 2. Verify ITP has assets (fully initialized)
    const state = await getItpStateL3(itp2Id);
    expect(state.assets.length, 'ITP should have assets').toBeGreaterThan(0);

    // 3. Record shares before buy
    const sharesBefore = await getL3UserShares(TEST_ADDRESS, itp2Id);

    // 4. Always use L3 direct path (avoids Settlement gas issues)
    const usdcAmount = 100n * 10n ** 18n;
    const limitPrice = state.nav > 0n ? state.nav * 3n : 10n * 10n ** 18n;
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

  test('sell second ITP order completes (not stuck at Executing trades)', async () => {
    test.setTimeout(300_000);

    // 1. Discover available ITPs
    const itpIds = await getAvailableItpIds(3);
    if (itpIds.length < 2) {
      console.log(`Only ${itpIds.length} ITP(s) available — skipping multi-ITP sell test`);
      test.skip();
      return;
    }

    const itp2Id = itpIds[1];
    console.log(`Multi-ITP sell: targeting ${itp2Id}`);

    // 2. Ensure user has L3 shares for this ITP
    let sharesBefore = await getL3UserShares(TEST_ADDRESS, itp2Id);
    if (sharesBefore < 50n * 10n ** 18n) {
      console.log('Insufficient shares — placing L3 buy order...');
      const state = await getItpStateL3(itp2Id);
      const buyLimit = state.nav > 0n ? state.nav * 3n : 10n * 10n ** 18n;
      await placeL3BuyOrderDirect(TEST_ADDRESS, itp2Id, 200n * 10n ** 18n, buyLimit);
      const newShares = await pollUntil(
        () => getL3UserShares(TEST_ADDRESS, itp2Id),
        (s) => s >= 50n * 10n ** 18n,
        180_000,
        3_000,
      );
      console.log(`Buy filled — shares: ${newShares}`);
    }

    // 3. Fund L3 Index with USDC so sell payouts don't fail
    await mintL3Usdc(INDEX_CONTRACT, 200n * 10n ** 18n);

    // 4. Record L3 shares before sell
    const l3SharesBefore = await getL3UserShares(TEST_ADDRESS, itp2Id);
    console.log(`ITP2 L3 shares before sell: ${l3SharesBefore}`);

    // 5. Place L3 sell order
    const sellAmount = l3SharesBefore > 50n * 10n ** 18n ? 50n * 10n ** 18n : l3SharesBefore;
    const limitPrice = 10n ** 16n; // $0.01 — low enough to accept any NAV
    const orderId = await placeL3SellOrderDirect(TEST_ADDRESS, itp2Id, sellAmount, limitPrice);
    console.log(`Placed ITP2 L3 sell order #${orderId}`);

    // 6. Wait for L3 shares to decrease
    const sharesAfter = await pollUntil(
      () => getL3UserShares(TEST_ADDRESS, itp2Id),
      (shares) => shares < l3SharesBefore,
      180_000,
      3_000,
    );
    console.log(`ITP2 sell order #${orderId} filled — L3 shares: ${l3SharesBefore} -> ${sharesAfter}`);
    expect(sharesAfter).toBeLessThan(l3SharesBefore);
  });

  test('first ITP sell still works after multi-ITP fix', async () => {
    test.setTimeout(300_000);

    // Discover the first available ITP
    const itpIds = await getAvailableItpIds(1);
    expect(itpIds.length, 'Need at least 1 ITP on L3').toBeGreaterThanOrEqual(1);
    const itp1Id = itpIds[0];
    console.log(`ITP1 sell: targeting ${itp1Id}`);

    // Ensure user has L3 shares
    let sharesBefore = await getL3UserShares(TEST_ADDRESS, itp1Id);
    if (sharesBefore < 25n * 10n ** 18n) {
      console.log('Insufficient shares — placing L3 buy order...');
      const state = await getItpStateL3(itp1Id);
      const buyLimit = state.nav > 0n ? state.nav * 3n : 10n * 10n ** 18n;
      await placeL3BuyOrderDirect(TEST_ADDRESS, itp1Id, 200n * 10n ** 18n, buyLimit);
      await pollUntil(
        () => getL3UserShares(TEST_ADDRESS, itp1Id),
        (s) => s >= 25n * 10n ** 18n,
        180_000,
        3_000,
      );
    }

    // Fund L3 Index with USDC so sell payouts don't fail
    await mintL3Usdc(INDEX_CONTRACT, 200n * 10n ** 18n);

    // L3 direct sell path
    const l3SharesBefore = await getL3UserShares(TEST_ADDRESS, itp1Id);
    console.log(`ITP1 L3 shares before sell: ${l3SharesBefore}`);

    const sellAmount = l3SharesBefore > 25n * 10n ** 18n ? 25n * 10n ** 18n : l3SharesBefore;
    const limitPrice = 10n ** 16n; // $0.01 — low enough to accept any NAV
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
