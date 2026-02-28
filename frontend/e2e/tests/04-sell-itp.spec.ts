import { test, expect, TEST_ADDRESS, ITP_ID } from '../fixtures/wallet';
import {
  connectWalletButton,
  sellButton,
  sellModal,
  itpCard,
} from '../helpers/selectors';
import { mintL3Shares, getL3UsdcBalance } from '../helpers/backend-api';

test.describe('Sell ITP', () => {
  test('sell ITP shares', async ({ walletPage: page }) => {
    test.setTimeout(240_000); // 4 min — issuer consensus can take 30-90s

    // 1. Connect wallet
    const connectBtn = connectWalletButton(page);
    await expect(connectBtn).toBeVisible({ timeout: 15_000 });
    await connectBtn.click();
    await page.mouse.move(0, 0);
    const truncated = TEST_ADDRESS.slice(0, 6) + '...' + TEST_ADDRESS.slice(-4);
    await expect(page.getByRole('button', { name: truncated })).toBeVisible({ timeout: 15_000 });

    // 2. Wait for ITP listing
    await expect(itpCard(page).first()).toBeVisible({ timeout: 30_000 });

    // 3. Mint L3 shares for sell test.
    // Sets _userShares + vault ERC20 tokens on L3 directly.
    // No BridgedITP needed — direct L3 path uses _userShares.
    const mintAmount = 100n * 10n ** 18n;
    await mintL3Shares(TEST_ADDRESS, ITP_ID, mintAmount);

    // Record initial L3 USDC balance to verify proceeds later
    const usdcBefore = await getL3UsdcBalance(TEST_ADDRESS);

    // 4. Click Sell on first ITP
    const sellBtn = sellButton(page);
    await expect(sellBtn).toBeVisible({ timeout: 10_000 });
    await sellBtn.click();

    // 5. Sell modal should appear (heading is "Sell {itpName}")
    await expect(page.getByRole('heading', { name: /^Sell\s/ })).toBeVisible({ timeout: 10_000 });

    // 6. Enter sell amount (50 shares)
    const sharesInput = sellModal.sharesInput(page);
    await expect(sharesInput).toBeVisible({ timeout: 10_000 });
    await sharesInput.fill('50');

    // 7. Submit (direct L3 path, no approval needed)
    const submitBtn = sellModal.submitButton(page);
    await expect(submitBtn).toBeEnabled({ timeout: 10_000 });
    await submitBtn.click();

    // 8. Wait for real issuer consensus pipeline to fill the sell order.
    // Direct L3: Index.submitOrder(SELL) → issuers batch + fill → L3_WUSDC proceeds.
    // start.sh already runs a block miner on both chains, no manual mining needed.
    await expect(sellModal.orderSubmittedBanner(page)).toBeVisible({ timeout: 180_000 });

    // 9. Verify L3 USDC balance increased (received proceeds)
    const usdcAfter = await getL3UsdcBalance(TEST_ADDRESS);
    expect(usdcAfter).toBeGreaterThan(usdcBefore);
  });
});
