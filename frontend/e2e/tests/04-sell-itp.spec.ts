import { test, expect, TEST_ADDRESS, ITP_ID } from '../fixtures/wallet';
import {
  getL3UsdcBalance, getL3UserShares, placeL3SellOrderDirect, pollUntil, mintL3Usdc,
} from '../helpers/backend-api';
import { CONTRACTS } from '../env';

const INDEX_CONTRACT = CONTRACTS.Index ?? '';

test.describe('Sell ITP', () => {
  test('sell ITP shares via L3 direct path', async () => {
    test.setTimeout(240_000);

    // 1. Verify user has shares from prior buy test
    const existingShares = await getL3UserShares(TEST_ADDRESS, ITP_ID);
    expect(existingShares, 'User should have ITP shares from prior buy test').toBeGreaterThan(0n);
    console.log(`Sell test: user has ${existingShares} shares`);

    // 2. Fund Index contract with USDC for sell payout
    await mintL3Usdc(INDEX_CONTRACT, 200n * 10n ** 18n);

    // 3. Record balances before sell
    const sharesBefore = await getL3UserShares(TEST_ADDRESS, ITP_ID);
    const usdcBefore = await getL3UsdcBalance(TEST_ADDRESS);

    // 4. Place L3 sell order directly (bypasses Settlement BridgedITP issue)
    const sellAmount = sharesBefore > 5n * 10n ** 18n ? 5n * 10n ** 18n : sharesBefore;
    const limitPrice = 10n ** 16n; // $0.01 — low enough to accept any NAV
    const orderId = await placeL3SellOrderDirect(TEST_ADDRESS, ITP_ID, sellAmount, limitPrice);
    console.log(`Placed L3 sell order #${orderId}`);

    // 5. Wait for shares to decrease or USDC to increase
    const result = await pollUntil(
      async () => ({
        shares: await getL3UserShares(TEST_ADDRESS, ITP_ID),
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
