import { test, expect, TEST_ADDRESS, ITP_ID } from '../fixtures/wallet';
import {
  connectWalletButton,
  sellButton,
  sellModal,
  itpCard,
} from '../helpers/selectors';
import { mintL3Shares, mintL3Usdc, getL3UsdcBalance, getL3UserShares } from '../helpers/backend-api';

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

    // Fund Index contract with USDC so it can pay sell proceeds.
    // Without this, confirmFills SELL transfer fails (insufficient balance)
    // and proceeds go to failedFillEscrow instead of the user.
    const INDEX_CONTRACT = '0x2279B7A0a67DB372996a5FaB50D91eAA73d2eBe6';
    await mintL3Usdc(INDEX_CONTRACT, 200n * 10n ** 18n);

    // Record initial L3 USDC balance and shares to verify proceeds later
    const usdcBefore = await getL3UsdcBalance(TEST_ADDRESS);
    const sharesBefore = await getL3UserShares(TEST_ADDRESS, ITP_ID);

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

    // 9. Verify L3 USDC balance increased (received proceeds)
    const usdcAfter = await getL3UsdcBalance(TEST_ADDRESS);
    expect(usdcAfter).toBeGreaterThan(usdcBefore);
    if (fillDetected === 'backend') {
      console.log(`Sell order filled (detected via backend): USDC ${usdcBefore} → ${usdcAfter}`);
    }
  });
});
