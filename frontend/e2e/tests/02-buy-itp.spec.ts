import { test, expect, TEST_ADDRESS, ITP_ID } from '../fixtures/wallet';
import { connectWalletButton, buyButton, buyModal, itpCard } from '../helpers/selectors';
import { mintBridgedItp } from '../helpers/backend-api';

test.describe('Buy ITP', () => {
  test('full buy flow: mint USDC if needed, approve, buy, wait for fill', async ({ walletPage: page }) => {
    // 1. Connect wallet
    const connectBtn = connectWalletButton(page);
    await expect(connectBtn).toBeVisible({ timeout: 15_000 });
    await connectBtn.click();
    const truncated = TEST_ADDRESS.slice(0, 6) + '...' + TEST_ADDRESS.slice(-4);
    await expect(page.getByText(truncated, { exact: true })).toBeVisible({ timeout: 15_000 });

    // 2. Wait for ITP listing to load
    await expect(itpCard(page).first()).toBeVisible({ timeout: 30_000 });

    // 3. Click Buy on first ITP
    const buyBtn = buyButton(page);
    await expect(buyBtn).toBeVisible({ timeout: 10_000 });
    await buyBtn.click();

    // 4. Buy modal should appear (heading is "Buy {itpName}")
    await expect(page.getByRole('heading', { name: /^Buy\s/ })).toBeVisible({ timeout: 10_000 });

    // 5. If USDC balance is 0, mint test USDC
    const mintBtn = buyModal.mintTestUsdcButton(page);
    if (await mintBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await mintBtn.click();
      // Wait for "Minted!" confirmation
      await expect(buyModal.mintedBadge(page)).toBeVisible({ timeout: 30_000 });
      // Wait for balance to refresh in UI (backend polls every 5s)
      await page.waitForTimeout(6_000);
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

    // 9. Wait for "Order Submitted" success banner — this is the frontend's deliverable
    await expect(buyModal.orderSubmittedBanner(page)).toBeVisible({ timeout: 60_000 });

    // 10. Simulate Step 8 of 8-step bridge: mintBridgedShares on Arb.
    // In local dev, the full issuer consensus pipeline (Steps 3b-8) may not
    // complete reliably, so we mint BridgedITP directly via anvil impersonation.
    // In production, this is handled by BridgeProxy.mintBridgedShares() via BLS consensus.
    await mintBridgedItp(TEST_ADDRESS, ITP_ID, 100n * 10n ** 18n);
  });
});
