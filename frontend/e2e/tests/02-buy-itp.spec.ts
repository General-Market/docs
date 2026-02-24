import { test, expect, TEST_ADDRESS, ITP_ID } from '../fixtures/wallet';
import { connectWalletButton, buyButton, buyModal, itpCard } from '../helpers/selectors';
import { mintBridgedItp } from '../helpers/backend-api';

test.describe('Buy ITP', () => {
  test('full buy flow: mint USDC if needed, approve, buy, wait for fill', async ({ walletPage: page }) => {
    // 1. Connect wallet
    const connectBtn = connectWalletButton(page);
    await expect(connectBtn).toBeVisible({ timeout: 15_000 });
    await connectBtn.click();
    await page.mouse.move(0, 0);
    const truncated = TEST_ADDRESS.slice(0, 6) + '...' + TEST_ADDRESS.slice(-4);
    await expect(page.getByRole('button', { name: truncated })).toBeVisible({ timeout: 15_000 });

    // 2. Wait for ITP listing to load
    await expect(itpCard(page).first()).toBeVisible({ timeout: 30_000 });

    // 3. Click Buy on first ITP
    const buyBtn = buyButton(page);
    await expect(buyBtn).toBeVisible({ timeout: 10_000 });
    await buyBtn.click();

    // 4. Buy modal should appear (heading is "Buy {itpName}")
    await expect(page.getByRole('heading', { name: /^Buy\s/ })).toBeVisible({ timeout: 10_000 });

    // 5. If USDC balance is 0, mint test USDC
    // Wait for balance to load first — mint button flashes briefly while balance is undefined
    await expect(page.getByText(/Balance:.*USDC/)).toBeVisible({ timeout: 10_000 });
    const mintBtn = buyModal.mintTestUsdcButton(page);
    if (await mintBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
      // Mint button can flash briefly while balance loads — use short click timeout
      const clicked = await mintBtn.click({ timeout: 5_000 }).then(() => true).catch(() => false);
      if (clicked) {
        await expect(buyModal.mintedBadge(page)).toBeVisible({ timeout: 30_000 });
        await page.waitForTimeout(6_000);
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
    await expect(page.getByText(/Relaying|Bridging|Batching/)).toBeVisible({ timeout: 30_000 });

    // 10. Simulate the cross-chain pipeline: mint BridgedITP shares directly.
    // In local dev, the full issuer consensus pipeline (Arb→L3 bridge, batch, fill,
    // L3→Arb bridge) doesn't complete automatically. We mint BridgedITP directly
    // via Anvil impersonation. The modal detects the balance increase and shows "Done".
    await mintBridgedItp(TEST_ADDRESS, ITP_ID, 100n * 10n ** 18n);

    // 11. Modal detects BridgedITP balance increase → shows "Buy More"
    await expect(buyModal.orderSubmittedBanner(page)).toBeVisible({ timeout: 60_000 });
  });
});
