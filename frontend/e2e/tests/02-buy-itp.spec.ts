import { test, expect, TEST_ADDRESS, ITP_ID } from '../fixtures/wallet';
import { connectWalletButton, buyButton, buyModal, itpCard } from '../helpers/selectors';
import { getL3UserShares } from '../helpers/backend-api';

test.describe('Buy ITP', () => {
  test('full buy flow: mint USDC if needed, approve, buy, wait for fill', async ({ walletPage: page }) => {
    test.setTimeout(240_000); // 4 min — issuer consensus can take 30-90s

    // 1. Connect wallet
    const connectBtn = connectWalletButton(page);
    await expect(connectBtn).toBeVisible({ timeout: 15_000 });
    await connectBtn.click();
    await page.mouse.move(0, 0);
    const truncated = TEST_ADDRESS.slice(0, 6) + '...' + TEST_ADDRESS.slice(-4);
    await expect(page.getByRole('button', { name: truncated })).toBeVisible({ timeout: 15_000 });

    // 2. Wait for ITP listing to load
    await expect(itpCard(page).first()).toBeVisible({ timeout: 30_000 });

    // Record initial L3 shares before buy
    const sharesBefore = await getL3UserShares(TEST_ADDRESS, ITP_ID);

    // 3. Click Buy on first ITP
    const buyBtn = buyButton(page);
    await expect(buyBtn).toBeVisible({ timeout: 10_000 });
    await buyBtn.click();

    // 4. Buy modal should appear (heading is "Buy {itpName}")
    await expect(page.getByRole('heading', { name: /^Buy\s/ })).toBeVisible({ timeout: 10_000 });

    // 5. If USDC balance is 0, mint test USDC (now L3_WUSDC, 18 decimals)
    await expect(page.getByText(/Balance:.*USDC/)).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(3_000); // let RPC balance query settle
    const balanceText = await page.getByText(/Balance:.*USDC/).textContent();
    const balanceNum = parseFloat(balanceText?.replace(/[^0-9.]/g, '') || '0');
    if (balanceNum < 100) {
      const mintBtn = buyModal.mintTestUsdcButton(page);
      if (await mintBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        const clicked = await mintBtn.click({ timeout: 5_000 }).then(() => true).catch(() => false);
        if (clicked) {
          await expect(buyModal.mintedBadge(page)).toBeVisible({ timeout: 30_000 });
          await page.waitForTimeout(6_000);
        }
      }
    }

    // 6. Enter buy amount (100 USDC)
    const amountInput = buyModal.amountInput(page);
    await expect(amountInput).toBeVisible({ timeout: 5_000 });
    await amountInput.fill('100');

    // 7. Limit price should auto-fill from NAV — wait for it
    const limitInput = buyModal.limitPriceInput(page);
    await expect(limitInput).not.toHaveValue('', { timeout: 15_000 });

    // 8. Click Approve & Buy (or Buy ITP if already approved)
    const submitBtn = buyModal.submitButton(page);
    await expect(submitBtn).toBeEnabled({ timeout: 15_000 });
    await submitBtn.click();

    // 9. Wait for buy tx to be confirmed (stepper enters "Process" phase)
    // Direct L3 path: order goes to Index.submitOrder, issuers batch + fill on L3
    await expect(page.getByText(/Batching|Filling/)).toBeVisible({ timeout: 30_000 });

    // 10. Wait for real issuer consensus pipeline to fill the order.
    // Issuers read L3 Index._orders every 200ms cycle, batch, and fill.
    // Modal detects L3 shares increase → shows "Buy More".
    await expect(buyModal.orderSubmittedBanner(page)).toBeVisible({ timeout: 180_000 });

    // 11. Verify L3 shares actually increased
    const sharesAfter = await getL3UserShares(TEST_ADDRESS, ITP_ID);
    expect(sharesAfter).toBeGreaterThan(sharesBefore);
  });
});
