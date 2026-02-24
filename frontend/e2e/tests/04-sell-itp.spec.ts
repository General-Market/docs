import { test, expect, TEST_ADDRESS, ITP_ID } from '../fixtures/wallet';
import {
  connectWalletButton,
  sellButton,
  sellModal,
  itpCard,
} from '../helpers/selectors';
import { getUserState, mintBridgedItp } from '../helpers/backend-api';

test.describe('Sell ITP', () => {
  test('sell ITP shares', async ({ walletPage: page }) => {
    // 1. Connect wallet
    const connectBtn = connectWalletButton(page);
    await expect(connectBtn).toBeVisible({ timeout: 15_000 });
    await connectBtn.click();
    await page.mouse.move(0, 0);
    const truncated = TEST_ADDRESS.slice(0, 6) + '...' + TEST_ADDRESS.slice(-4);
    await expect(page.getByRole('button', { name: truncated })).toBeVisible({ timeout: 15_000 });

    // 2. Wait for ITP listing
    await expect(itpCard(page).first()).toBeVisible({ timeout: 30_000 });

    // 3. Ensure user has ITP shares to sell (mint if bridge relay hasn't completed)
    const preState = await getUserState(TEST_ADDRESS, ITP_ID);
    if (BigInt(preState.bridged_itp_balance) === 0n) {
      await mintBridgedItp(TEST_ADDRESS, ITP_ID, 100n * 10n ** 18n);
    }

    // 4. Click Sell on first ITP
    const sellBtn = sellButton(page);
    await expect(sellBtn).toBeVisible({ timeout: 10_000 });
    await sellBtn.click();

    // 5. Sell modal should appear (heading is "Sell {itpName}")
    await expect(page.getByRole('heading', { name: /^Sell\s/ })).toBeVisible({ timeout: 10_000 });

    // 6. Click Max to sell all shares
    const maxBtn = sellModal.maxButton(page);
    await expect(maxBtn).toBeVisible({ timeout: 10_000 });
    await maxBtn.click();

    // 7. Submit (Approve & Sell or Sell Shares)
    const submitBtn = sellModal.submitButton(page);
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 });
    await submitBtn.click();

    // 8. Wait for "Cross-Chain Sell Order Submitted" success banner
    // Cross-chain relay can take >60s when chain is busy from prior tests
    await expect(sellModal.orderSubmittedBanner(page)).toBeVisible({ timeout: 120_000 });
  });
});
