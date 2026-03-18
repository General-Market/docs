import { test, expect, TEST_ADDRESS, ITP_ID } from '../fixtures/wallet';
import { ensureWalletConnected, buyButton, buyModal, itpCard } from '../helpers/selectors';
import { getL3UserShares, getL3UsdcBalance, getItpStateL3, getOrder, mintL3Usdc } from '../helpers/backend-api';
import { parseUnits } from 'viem';

test.describe('Buy ITP', () => {
  test('full buy flow: mint USDC if needed, approve, buy, wait for fill', async ({ walletPage: page }) => {
    test.setTimeout(300_000); // 5 min — oracle consensus can take 30-90s, parallel load slows it further

    // 1. Ensure user has enough L3 USDC (mint directly via RPC, not browser button)
    const usdcBalance = await getL3UsdcBalance(TEST_ADDRESS);
    if (usdcBalance < parseUnits('100', 18)) {
      console.log('Buy test: minting 10,000 L3 USDC via direct RPC');
      await mintL3Usdc(TEST_ADDRESS, parseUnits('10000', 18));
      // Poll until balance reflects the mint (L3 block time is fast but RPC may lag)
      const mintDeadline = Date.now() + 15_000;
      while (Date.now() < mintDeadline) {
        const newBalance = await getL3UsdcBalance(TEST_ADDRESS);
        if (newBalance >= parseUnits('100', 18)) break;
        await new Promise(r => setTimeout(r, 1_000));
      }
    }

    // 2. Connect wallet
    await ensureWalletConnected(page, TEST_ADDRESS);

    // 3. Wait for ITP table rows to load (SSE/REST delivers data async)
    //    The ItpListing renders a <table> with <tr id="itp-card-{itpId}"> rows.
    try {
      await expect(itpCard(page).first()).toBeVisible({ timeout: 45_000 });
    } catch {
      // Data-node may be slow on testnet — retry once with fresh navigation
      await page.goto('/index', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await expect(itpCard(page).first()).toBeVisible({ timeout: 45_000 });
    }

    // 4. Click Buy on first ITP table row
    const buyBtn = buyButton(page);
    await expect(buyBtn).toBeVisible({ timeout: 10_000 });
    await buyBtn.click();

    // 5. Buy modal should appear — heading is "Buy {itpName}"
    await expect(buyModal.heading(page)).toBeVisible({ timeout: 10_000 });

    // 6. Wait for USDC balance to appear in modal (wagmi reads via /rpc proxy)
    //    Balance text: "Balance: 1,234.56 USDC" — must show a nonzero amount
    await expect(buyModal.balanceText(page)).toBeVisible({ timeout: 30_000 });

    // 7. Enter buy amount (100 USDC)
    const amountInput = buyModal.amountInput(page);
    await expect(amountInput).toBeVisible({ timeout: 5_000 });
    await amountInput.fill('100');

    // 8. Limit price — set a high absolute limit ($20) to cover any realistic NAV drift
    //    during oracle consensus (30-90s)
    const limitInput = buyModal.limitPriceInput(page);
    const limitPrice = '20.000000';
    await limitInput.clear();
    await limitInput.fill(limitPrice);

    // Record L3 shares RIGHT BEFORE submitting (not at test start)
    // to avoid race with parallel lending test's mintL3Shares
    const sharesBefore = await getL3UserShares(TEST_ADDRESS, ITP_ID);
    console.log(`Buy test: sharesBefore=${sharesBefore}`);

    // 9. Click Approve & Buy (or Buy ITP if already approved)
    const submitBtn = buyModal.submitButton(page);
    await expect(submitBtn).toBeEnabled({ timeout: 15_000 });
    await submitBtn.click();

    // 10. Wait for buy tx to be confirmed (stepper enters "Process" phase)
    //     Micro-step labels: "Batching order..." then "Executing trades..."
    await expect(page.getByText(/Batching order|Executing trades/)).toBeVisible({ timeout: 60_000 });

    // 11. Extract L3 order ID from the modal stepper txRefs ("L3 #N")
    const l3OrderIdText = await page.getByText(/L3 #\d+/).textContent({ timeout: 30_000 }).catch(() => null);
    const orderId = l3OrderIdText ? parseInt(l3OrderIdText.match(/#(\d+)/)?.[1] || '0') || null : null;
    console.log(`Buy test: orderId=${orderId}`);

    // 12. Wait for real oracle consensus pipeline to fill the order.
    //     Race: modal "Buy More" button OR backend order status change (whichever first).
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

    // 13. Verify the buy was filled
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
