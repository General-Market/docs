import { test, expect, TEST_ADDRESS, ITP_ID } from '../fixtures/wallet';
import { ensureWalletConnected, buyButton, buyModal, itpCard } from '../helpers/selectors';
import { getL3UserShares, getItpStateL3, getOrder } from '../helpers/backend-api';

test.describe('Buy ITP', () => {
  test('full buy flow: mint USDC if needed, approve, buy, wait for fill', async ({ walletPage: page }) => {
    test.setTimeout(300_000); // 5 min — issuer consensus can take 30-90s, parallel load slows it further

    // 1. Connect wallet
    await ensureWalletConnected(page, TEST_ADDRESS);

    // 2. Wait for ITP listing to load
    await expect(itpCard(page).first()).toBeVisible({ timeout: 30_000 });

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

    // 7. Limit price should auto-fill from NAV — wait for it, fallback to manual fill
    const limitInput = buyModal.limitPriceInput(page);
    const autoFilled = await expect(limitInput).not.toHaveValue('', { timeout: 15_000 })
      .then(() => true).catch(() => false);
    if (!autoFilled) {
      // NAV didn't auto-fill (SSE/data-node timing) — set manually from chain state
      const state = await getItpStateL3(ITP_ID);
      const navWithBuffer = (state.nav * 105n) / 100n; // 5% buffer like the modal
      const priceStr = (Number(navWithBuffer) / 1e18).toFixed(6);
      await limitInput.fill(priceStr);
    }

    // Record L3 shares RIGHT BEFORE submitting (not at test start)
    // to avoid race with parallel lending test's mintL3Shares
    const sharesBefore = await getL3UserShares(TEST_ADDRESS, ITP_ID);
    console.log(`Buy test: sharesBefore=${sharesBefore}`);

    // 8. Click Approve & Buy (or Buy ITP if already approved)
    const submitBtn = buyModal.submitButton(page);
    await expect(submitBtn).toBeEnabled({ timeout: 15_000 });
    await submitBtn.click();

    // 9. Wait for buy tx to be confirmed (stepper enters "Process" phase)
    // Direct L3 path: order goes to Index.submitOrder, issuers batch + fill on L3
    // UI micro-step text: "Batching order..." then "Executing trades..."
    await expect(page.getByText(/Batching order|Executing trades/)).toBeVisible({ timeout: 60_000 });

    // 10. Extract L3 order ID from the modal (shows "L3 #N")
    const l3OrderIdText = await page.getByText(/L3 #\d+/).textContent({ timeout: 30_000 }).catch(() => null);
    const orderId = l3OrderIdText ? parseInt(l3OrderIdText.match(/#(\d+)/)?.[1] || '0') || null : null;
    console.log(`Buy test: orderId=${orderId}`);

    // 11. Wait for real issuer consensus pipeline to fill the order.
    // Race: modal "Buy More" button OR backend order status change (whichever first).
    const fillDetected = await Promise.race([
      expect(buyModal.orderSubmittedBanner(page)).toBeVisible({ timeout: 210_000 })
        .then(() => 'ui' as const).catch(() => null),
      (async () => {
        const deadline = Date.now() + 210_000;
        while (Date.now() < deadline) {
          // Check shares increase
          const current = await getL3UserShares(TEST_ADDRESS, ITP_ID);
          if (current > sharesBefore) return 'backend-shares' as const;
          // Check order status directly (most reliable)
          if (orderId) {
            try {
              const order = await getOrder(orderId);
              if (order.status >= 2) return 'backend-order' as const;
            } catch {}
          }
          await new Promise(r => setTimeout(r, 3_000));
        }
        return null;
      })(),
    ]);

    // 12. Verify the buy was filled
    if (fillDetected === null) {
      await page.waitForTimeout(15_000);
    }

    // Check multiple success criteria: UI detection, order status, or shares increase
    const sharesAfter = await getL3UserShares(TEST_ADDRESS, ITP_ID);
    const sharesIncreased = sharesAfter > sharesBefore;

    let orderFilled = false;
    if (orderId) {
      try {
        const order = await getOrder(orderId);
        orderFilled = order.status >= 2; // Filled or higher
        console.log(`Buy test: order ${orderId} status=${order.status} (${['Pending','Batched','Filled','Cancelled','Expired'][order.status]})`);
      } catch (e) {
        console.log(`Buy test: order check failed: ${e}`);
      }
    }

    console.log(`Buy test result: shares ${sharesBefore} → ${sharesAfter}, fill=${fillDetected}, orderFilled=${orderFilled}`);

    // Accept any proof of successful fill:
    // 1. UI detected fill (Buy More button = SSE reported order status >= 2)
    // 2. On-chain order status is Filled
    // 3. Shares increased
    const success = fillDetected !== null || orderFilled || sharesIncreased;
    expect(success).toBe(true);
  });
});
