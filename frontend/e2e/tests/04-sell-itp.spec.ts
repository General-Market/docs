import { test, expect, TEST_ADDRESS } from '../fixtures/wallet';
import {
  getL3UsdcBalance, getL3UserShares, placeL3BuyOrderDirect, placeL3SellOrderDirect,
  pollUntil, mintL3Usdc, getFirstAvailableItpId, getItpStateL3,
} from '../helpers/backend-api';
import { CONTRACTS } from '../env';

const INDEX_CONTRACT = CONTRACTS.Index ?? '';

test.describe('Sell ITP', () => {
  test('sell ITP shares via L3 direct path', async () => {
    test.setTimeout(300_000);

    // 1. Discover a valid ITP on L3
    const itpId = await getFirstAvailableItpId();
    console.log(`Sell test: using ITP ${itpId}`);

    // 2. Ensure user has shares — buy first if none exist (fresh deployment)
    let existingShares = await getL3UserShares(TEST_ADDRESS, itpId);
    if (existingShares === 0n) {
      console.log('Sell test: no shares — placing buy order first');
      const state = await getItpStateL3(itpId);
      const limitPrice = state.nav > 0n ? state.nav * 3n : 10n * 10n ** 18n;
      const orderId = await placeL3BuyOrderDirect(TEST_ADDRESS, itpId, 200n * 10n ** 18n, limitPrice);
      console.log(`Sell test: placed buy order #${orderId}, waiting for fill...`);
      existingShares = await pollUntil(
        () => getL3UserShares(TEST_ADDRESS, itpId),
        (shares) => shares > 0n,
        180_000,
        3_000,
      );
      console.log(`Sell test: buy filled — now have ${existingShares} shares`);
    }
    expect(existingShares, 'User should have ITP shares').toBeGreaterThan(0n);
    console.log(`Sell test: user has ${existingShares} shares`);

    // 3. Fund Index contract with USDC for sell payout
    await mintL3Usdc(INDEX_CONTRACT, 200n * 10n ** 18n);

    // 4. Record balances before sell
    const sharesBefore = await getL3UserShares(TEST_ADDRESS, itpId);
    const usdcBefore = await getL3UsdcBalance(TEST_ADDRESS);

    // 5. Place L3 sell order directly (bypasses Settlement BridgedITP issue)
    const sellAmount = sharesBefore > 5n * 10n ** 18n ? 5n * 10n ** 18n : sharesBefore;
    const limitPrice = 10n ** 16n; // $0.01 — low enough to accept any NAV
    const orderId = await placeL3SellOrderDirect(TEST_ADDRESS, itpId, sellAmount, limitPrice);
    console.log(`Placed L3 sell order #${orderId}`);

    // 6. Wait for shares to decrease or USDC to increase
    const result = await pollUntil(
      async () => ({
        shares: await getL3UserShares(TEST_ADDRESS, itpId),
        usdc: await getL3UsdcBalance(TEST_ADDRESS),
      }),
      (r) => r.shares < sharesBefore || r.usdc > usdcBefore,
      180_000,
      3_000,
    );
    console.log(`Sell order #${orderId} filled — shares: ${sharesBefore} → ${result.shares}, USDC: ${usdcBefore} → ${result.usdc}`);
    expect(result.shares < sharesBefore || result.usdc > usdcBefore).toBe(true);
  });
});
