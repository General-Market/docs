import { test, expect, TEST_ADDRESS, ITP_ID } from '../fixtures/wallet';
import {
  ensureWalletConnected,
  sellButton,
  sellModal,
  itpCard,
} from '../helpers/selectors';
import { getL3UsdcBalance, getL3UserShares } from '../helpers/backend-api';

test.describe('Sell ITP', () => {
  test('sell ITP shares', async ({ walletPage: page }) => {
    test.setTimeout(240_000); // 4 min — issuer consensus can take 30-90s

    // 1. Connect wallet
    await ensureWalletConnected(page, TEST_ADDRESS);

    // 2. Wait for ITP listing
    await expect(itpCard(page).first()).toBeVisible({ timeout: 30_000 });

    // 3. Verify user has shares from prior buy test (no minting — real system state)
    const existingShares = await getL3UserShares(TEST_ADDRESS, ITP_ID);
    if (existingShares === 0n) {
      test.skip(true, 'No ITP shares available — buy test may not have filled yet');
      return;
    }
    console.log(`Sell test: user has ${existingShares} shares from prior buy`);

    // 4. Click Sell on first ITP
    const sellBtn = sellButton(page);
    await expect(sellBtn).toBeVisible({ timeout: 10_000 });
    await sellBtn.click();

    // 5. Sell modal should appear (heading is "Sell {itpName}")
    await expect(page.getByRole('heading', { name: /^Sell\s/ })).toBeVisible({ timeout: 10_000 });

    // 6. Use MAX button or enter sell amount (half of shares)
    const sharesInput = sellModal.sharesInput(page);
    await expect(sharesInput).toBeVisible({ timeout: 10_000 });
    const halfShares = Number(existingShares / (10n ** 18n)) / 2;
    await sharesInput.fill(String(Math.max(1, Math.floor(halfShares))));

    // Record balances RIGHT BEFORE submitting (avoid race with parallel tests)
    const usdcBefore = await getL3UsdcBalance(TEST_ADDRESS);
    const sharesBefore = await getL3UserShares(TEST_ADDRESS, ITP_ID);
    console.log(`Sell test pre-submit: shares=${sharesBefore}, USDC=${usdcBefore}`);

    // 7. Submit (direct L3 path, no approval needed)
    const submitBtn = sellModal.submitButton(page);
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 });
    await submitBtn.click();

    // 8. Wait for real issuer consensus pipeline to fill the sell order.
    // Direct L3: Index.submitOrder(SELL) → issuers batch + fill → L3_WUSDC proceeds.
    // Race: modal "Sell More" button OR backend shares decrease (whichever first).
    const fillDetected = await Promise.race([
      expect(sellModal.orderSubmittedBanner(page)).toBeVisible({ timeout: 180_000 })
        .then(() => 'ui' as const).catch(() => null),
      (async () => {
        const deadline = Date.now() + 180_000;
        while (Date.now() < deadline) {
          const currentShares = await getL3UserShares(TEST_ADDRESS, ITP_ID);
          if (currentShares < sharesBefore) return 'backend' as const;
          const currentUsdc = await getL3UsdcBalance(TEST_ADDRESS);
          if (currentUsdc > usdcBefore) return 'backend' as const;
          await new Promise(r => setTimeout(r, 5_000));
        }
        return null;
      })(),
    ]);

    // 9. Verify the sell was filled
    if (fillDetected === null) {
      // Order may still be pending — give issuer one more chance
      await page.waitForTimeout(10_000);
    }
    const usdcAfter = await getL3UsdcBalance(TEST_ADDRESS);
    const sharesAfter = await getL3UserShares(TEST_ADDRESS, ITP_ID);
    console.log(`Sell test result: shares=${sharesBefore}→${sharesAfter}, USDC=${usdcBefore}→${usdcAfter}`);
    // Accept either USDC increase OR shares decrease as proof of fill
    const usdcIncreased = usdcAfter > usdcBefore;
    const sharesDecreased = sharesAfter < sharesBefore;
    expect(usdcIncreased || sharesDecreased).toBe(true);
  });
});
