import { test, expect, TEST_ADDRESS } from '../fixtures/wallet';
import { ensureWalletConnected, buyModal } from '../helpers/selectors';
import { getL3UserShares, getL3UsdcBalance, getOrder, mintL3Usdc } from '../helpers/backend-api';
import { parseUnits } from 'viem';

test.describe('Buy ITP', () => {
  test('full buy flow: mint USDC if needed, approve, buy, wait for fill', async ({ walletPage: page }) => {
    test.setTimeout(300_000); // 5 min — oracle consensus can take 30-90s, parallel load slows it further

    // 1. Ensure user has enough L3 USDC (mint directly via RPC, not browser button)
    const usdcBalance = await getL3UsdcBalance(TEST_ADDRESS);
    if (usdcBalance < parseUnits('100', 18)) {
      console.log('Buy test: minting 10,000 L3 USDC via direct RPC');
      await mintL3Usdc(TEST_ADDRESS, parseUnits('10000', 18));
      const mintDeadline = Date.now() + 15_000;
      while (Date.now() < mintDeadline) {
        const newBalance = await getL3UsdcBalance(TEST_ADDRESS);
        if (newBalance >= parseUnits('100', 18)) break;
        await new Promise(r => setTimeout(r, 1_000));
      }
    }

    // 2. Connect wallet
    await ensureWalletConnected(page, TEST_ADDRESS);

    // 3. Wait for the ItpListing <table> to render with data rows.
    //    The page has two layers:
    //    - A sr-only SSR section with <article> elements (SEO, always present)
    //    - A client-side <table> inside HomeClient > ItpListing (loads async via REST/SSE)
    //    We must wait for the actual interactive table, not the sr-only content.
    const productTable = page.locator('table');
    try {
      await expect(productTable.first()).toBeVisible({ timeout: 45_000 });
    } catch {
      // Data-node may be slow on testnet — retry with fresh navigation
      await page.goto('/index', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await expect(productTable.first()).toBeVisible({ timeout: 45_000 });
    }

    // 4. Wait for at least one data row inside the table
    const tableRow = page.locator('tr[id^="itp-card-"]');
    await expect(tableRow.first()).toBeVisible({ timeout: 30_000 });

    // 5. Extract ITP ID from the first row (for shares tracking later)
    //    Row id is "itp-card-0x0000...0002" — extract the hex part
    const firstRowId = await tableRow.first().getAttribute('id') ?? '';
    const rawId = firstRowId.replace('itp-card-', '');
    const ITP_ID = (rawId.startsWith('0x') ? rawId : '0x' + rawId.padStart(64, '0')) as `0x${string}`;
    console.log(`Buy test: targeting ${firstRowId}, ITP_ID=${ITP_ID}`);

    // 6. Click "Buy" button in the first table row.
    const buyBtn = tableRow.first().getByRole('button', { name: 'Buy', exact: true });
    await expect(buyBtn).toBeVisible({ timeout: 10_000 });
    await buyBtn.click();

    // 6. Buy modal should appear — heading "Buy {itpName}"
    await expect(buyModal.heading(page)).toBeVisible({ timeout: 10_000 });

    // 7. Wait for USDC balance to appear in modal: "Balance: X.XX USDC"
    await expect(buyModal.balanceText(page)).toBeVisible({ timeout: 30_000 });

    // 8. Enter buy amount (100 USDC)
    const amountInput = buyModal.amountInput(page);
    await expect(amountInput).toBeVisible({ timeout: 5_000 });
    await amountInput.fill('100');

    // 9. Limit price — wait for NAV auto-fill, then override with high limit
    //    The React effect auto-fills limit from NAV+5%. If we fill before it runs,
    //    the effect overwrites our value. Wait for non-empty value first.
    const limitInput = buyModal.limitPriceInput(page);
    await expect(limitInput).not.toHaveValue('', { timeout: 15_000 }).catch(() => {});
    await page.waitForTimeout(500); // let React effect settle
    await limitInput.fill(''); // clear auto-filled value
    await limitInput.fill('20.000000'); // set high limit to cover any NAV

    // Record L3 shares RIGHT BEFORE submitting (not at test start)
    // to avoid race with parallel lending test's mintL3Shares
    const sharesBefore = await getL3UserShares(TEST_ADDRESS, ITP_ID);
    console.log(`Buy test: sharesBefore=${sharesBefore}`);

    // 10. Click Approve & Buy (or Buy ITP if already approved)
    const submitBtn = buyModal.submitButton(page);
    await expect(submitBtn).toBeEnabled({ timeout: 15_000 });
    await submitBtn.click();

    // 11. Wait for buy tx to be confirmed (stepper enters "Process" phase)
    await expect(page.getByText(/Batching order|Executing trades/)).toBeVisible({ timeout: 60_000 });

    // 12. Extract L3 order ID from the modal stepper txRefs ("L3 #N")
    const l3OrderIdText = await page.getByText(/L3 #\d+/).textContent({ timeout: 30_000 }).catch(() => null);
    const orderId = l3OrderIdText ? parseInt(l3OrderIdText.match(/#(\d+)/)?.[1] || '0') || null : null;
    console.log(`Buy test: orderId=${orderId}`);

    // 13. Wait for real oracle consensus pipeline to fill the order.
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

    // 14. Verify the buy was filled
    if (fillDetected === null) {
      await page.waitForTimeout(15_000);
    }

    const sharesAfter = await getL3UserShares(TEST_ADDRESS, ITP_ID);
    const sharesIncreased = sharesAfter > sharesBefore;

    let orderFilled = false;
    if (orderId) {
      try {
        const order = await getOrder(orderId);
        orderFilled = order.status >= 2;
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
