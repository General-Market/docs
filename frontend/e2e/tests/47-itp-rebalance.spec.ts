import { test, expect, TEST_ADDRESS, FRONTEND_URL } from '../fixtures/wallet';
import { ensureWalletConnected } from '../helpers/selectors';
import {
  getItpStateL3,
  getItpCountL3,
  requestRebalanceDirect,
} from '../helpers/backend-api';

/**
 * Navigate to an ITP detail page and wait for hydration.
 */
async function navigateToItpPage(page: import('@playwright/test').Page, itpId: string) {
  await page.goto(`${FRONTEND_URL}/itp/${itpId}`, {
    waitUntil: 'domcontentloaded',
    timeout: 60_000,
  });
  // Wait for React hydration
  await page.waitForFunction(
    () => {
      const btn = document.querySelector('button');
      if (!btn) return false;
      return Object.keys(btn).some(k => k.startsWith('__reactFiber') || k.startsWith('__reactProps'));
    },
    { timeout: 30_000 }
  ).catch(() => {});
  // Wait for wagmi connector to initialize
  await page.waitForFunction(
    () => !!document.querySelector('button[class*="connect"], header button'),
    { timeout: 10_000 }
  ).catch(() => {});
}

test.describe('ITP Detail & Rebalance', () => {
  /**
   * Test 1: ITP detail page loads with NAV and holdings.
   * Navigate to the first ITP's detail page, verify basic data renders.
   */
  test('ITP detail page loads with NAV and holdings', async ({ walletPage: page }) => {
    test.setTimeout(120_000);

    // Find the first valid ITP on L3
    const itpCount = await getItpCountL3();
    expect(itpCount, 'At least one ITP must exist').toBeGreaterThanOrEqual(1);

    const itpId = '0x' + '0'.repeat(63) + '1';
    const state = await getItpStateL3(itpId);
    expect(state.assets.length, 'ITP1 must have assets').toBeGreaterThan(0);

    // Navigate to detail page
    await navigateToItpPage(page, itpId);

    // Verify NAV renders (KeyStatsBar shows "$X.XXXX")
    const navText = page.locator('text=/\\$\\d+\\.\\d{4}/').first();
    await expect(navText).toBeVisible({ timeout: 30_000 });

    // Verify holdings table loads (scroll down to Holdings tab first)
    const holdingsTab = page.getByText('Holdings', { exact: true }).first();
    if (await holdingsTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await holdingsTab.click();
    }

    // Holdings table should show at least one row or the holdings heading
    const holdingsHeading = page.getByRole('heading', { name: 'Holdings' });
    await expect(holdingsHeading).toBeVisible({ timeout: 15_000 });

    console.log(`ITP detail page loaded: itpId=${itpId}, assets=${state.assets.length}`);
  });

  /**
   * Test 2: ITP detail shows creator address in Fund Facts.
   * Navigate to ITP detail → Key Facts tab → verify creator address is displayed.
   */
  test('ITP detail shows creator address', async ({ walletPage: page }) => {
    test.setTimeout(120_000);

    const itpId = '0x' + '0'.repeat(63) + '1';
    const state = await getItpStateL3(itpId);
    const expectedCreator = state.creator.toLowerCase();

    await navigateToItpPage(page, itpId);

    // Navigate to Key Facts tab
    const keyFactsTab = page.getByText('Key Facts', { exact: true }).first();
    if (await keyFactsTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await keyFactsTab.click();
    }

    // Wait for creator address to load (fetched async)
    const creatorRow = page.locator('[data-testid="creator-address"]');
    await expect(creatorRow).toBeVisible({ timeout: 30_000 });

    // Verify the displayed address contains part of the real creator address
    const creatorText = await creatorRow.textContent();
    expect(creatorText).toBeTruthy();

    // The truncated format is "0xABCDEF01...234567" — check first 8 chars match
    const creatorPrefix = expectedCreator.slice(0, 8).toLowerCase();
    expect(creatorText!.toLowerCase()).toContain(creatorPrefix);

    console.log(`Creator address displayed: ${expectedCreator}`);
  });

  /**
   * Test 3: Rebalance request submits successfully.
   * Connect as ITP creator → navigate to their ITP → expand rebalance section →
   * adjust weights → submit requestRebalance → verify success.
   */
  test('rebalance request submits successfully', async ({ walletPage: page }) => {
    test.setTimeout(300_000);

    // The deployer (TEST_ADDRESS) created ITP #1
    const itpId = '0x' + '0'.repeat(63) + '1';
    const state = await getItpStateL3(itpId);

    // Confirm the deployer is the creator
    expect(
      state.creator.toLowerCase(),
      'Deployer must be the ITP creator'
    ).toBe(TEST_ADDRESS.toLowerCase());
    expect(state.assets.length, 'ITP must have assets').toBeGreaterThanOrEqual(2);

    // Navigate to the ITP detail page
    await navigateToItpPage(page, itpId);

    // Ensure wallet is connected
    await ensureWalletConnected(page, TEST_ADDRESS);

    // Find and expand the rebalance section
    const rebalanceSection = page.locator('[data-testid="rebalance-section"]');
    await expect(rebalanceSection).toBeVisible({ timeout: 30_000 });

    const toggleBtn = page.locator('[data-testid="rebalance-toggle"]');
    await expect(toggleBtn).toBeVisible({ timeout: 10_000 });
    await toggleBtn.click();

    // Verify the rebalance table loaded with asset rows
    const rebalanceTable = page.locator('[data-testid="rebalance-table"]');
    await expect(rebalanceTable).toBeVisible({ timeout: 15_000 });

    const rows = page.locator('[data-testid="rebalance-row"]');
    const rowCount = await rows.count();
    expect(rowCount, 'Rebalance table should have rows').toBeGreaterThanOrEqual(2);

    // Click "Equal Weights" to set all weights equally
    const equalBtn = page.locator('[data-testid="rebalance-equal"]');
    await equalBtn.click();

    // Verify weight sum is 100%
    const weightSum = page.locator('[data-testid="rebalance-weight-sum"]');
    await expect(weightSum).toContainText('100.00%', { timeout: 5_000 });

    // Adjust the first asset weight slightly: read current, add 1%, subtract 1% from second
    const weightInputs = page.locator('[data-testid="rebalance-weight-input"]');
    const firstInput = weightInputs.first();
    const secondInput = weightInputs.nth(1);

    const firstVal = await firstInput.inputValue();
    const secondVal = await secondInput.inputValue();
    const newFirst = (parseFloat(firstVal) + 1).toFixed(2);
    const newSecond = (parseFloat(secondVal) - 1).toFixed(2);

    await firstInput.fill(newFirst);
    await secondInput.fill(newSecond);

    // Weight sum should still be ~100%
    await expect(weightSum).toContainText('100.00%', { timeout: 5_000 });

    // Enter a note
    const noteInput = page.locator('[data-testid="rebalance-note"]');
    await noteInput.fill('E2E rebalance test');

    // Submit the rebalance request
    const submitBtn = page.getByRole('button', { name: 'Request Rebalance' });
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
    await submitBtn.click();

    // Wait for success — the mock wallet auto-signs, so this should complete
    const successBanner = page.locator('[data-testid="rebalance-success"]');
    await expect(successBanner).toBeVisible({ timeout: 90_000 });

    console.log('Rebalance request submitted successfully');
  });

  /**
   * Test 4: Rebalance via direct backend call (no browser).
   * Uses requestRebalanceDirect to verify the contract call works end-to-end.
   */
  test('rebalance request via direct RPC succeeds', async () => {
    test.setTimeout(120_000);

    const itpId = '0x' + '0'.repeat(63) + '1';
    const stateBefore = await getItpStateL3(itpId);
    expect(stateBefore.assets.length).toBeGreaterThanOrEqual(2);

    const nonce = await requestRebalanceDirect(itpId);
    expect(nonce, 'Rebalance nonce should be a number').toBeGreaterThanOrEqual(0);

    console.log(`Direct rebalance request succeeded: nonce=${nonce}`);
  });
});
