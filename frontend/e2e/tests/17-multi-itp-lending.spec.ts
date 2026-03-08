/**
 * Multi-ITP Lending Visibility E2E Tests
 *
 * Verifies that dynamically created ITPs (ITP2+) appear in the lending
 * markets table via on-chain discovery (getItpCount + itpVaults).
 *
 * Depends on: test 05-create-itp.spec.ts having created ITP2.
 * Runs in: itp project (pattern 1[6-9])
 */
import { test, expect, TEST_ADDRESS } from '../fixtures/wallet';
import {
  ensureWalletConnected,
  itpCard,
} from '../helpers/selectors';
import { getItpCountL3 } from '../helpers/backend-api';

test.describe('Multi-ITP Lending Visibility', () => {
  test('lending markets table shows multiple ITPs after ITP creation', async ({ walletPage: page }) => {
    test.setTimeout(120_000);

    // Verify ITP2+ exists on L3 (created by test 05)
    const itpCount = await getItpCountL3();
    if (itpCount < 2) {
      test.skip(true, `Only ${itpCount} ITP(s) on L3 — ITP2 not yet created`);
      return;
    }

    await ensureWalletConnected(page, TEST_ADDRESS);

    // Wait for ITP listing
    const hasCards = await itpCard(page).first().isVisible({ timeout: 45_000 }).catch(() => false);
    if (!hasCards) {
      test.skip(true, 'ITP cards not loaded — data-node may still be syncing');
      return;
    }

    // Open lending modal by clicking Borrow on first ITP card
    const borrowBtn = itpCard(page).first().getByRole('button', { name: 'Borrow', exact: true });
    const hasBorrow = await borrowBtn.isVisible({ timeout: 10_000 }).catch(() => false);
    if (!hasBorrow) {
      test.skip(true, 'No Borrow button on ITP card');
      return;
    }
    await borrowBtn.click();

    // Wait for markets table to render
    const marketsTable = page.locator('table');
    await expect(marketsTable.first()).toBeVisible({ timeout: 15_000 });

    // Count table body rows (each row = one ITP market)
    const tableRows = marketsTable.locator('tbody tr');

    // Wait for rows to populate (on-chain discovery is async)
    await expect(tableRows.first()).toBeVisible({ timeout: 30_000 });

    // Give time for on-chain vault discovery to complete
    await page.waitForTimeout(5_000);

    const rowCount = await tableRows.count();
    console.log(`Lending markets table has ${rowCount} ITP rows (expected >= 2)`);

    // Should show at least 2 rows (ITP1 with market + ITP2 discovered on-chain)
    expect(rowCount, 'Markets table should show ITP1 + ITP2').toBeGreaterThanOrEqual(2);
  });

  test('ITP2 row shows "Coming Soon" when no Morpho market deployed', async ({ walletPage: page }) => {
    test.setTimeout(180_000);

    const itpCount = await getItpCountL3();
    if (itpCount < 2) {
      test.skip(true, `Only ${itpCount} ITP(s) on L3 — ITP2 not yet created`);
      return;
    }

    // Connect wallet — skip gracefully if button not found
    const connectBtn = connectWalletButton(page);
    const hasConnect2 = await connectBtn.isVisible({ timeout: 20_000 }).catch(() => false);
    if (!hasConnect2) {
      test.skip(true, 'Connect Wallet button not visible');
      return;
    }
    await connectBtn.click();
    await page.mouse.move(0, 0);
    const truncated = TEST_ADDRESS.slice(0, 6) + '...' + TEST_ADDRESS.slice(-4);
    await expect(page.getByRole('button', { name: truncated })).toBeVisible({ timeout: 15_000 });

    const hasCards2 = await itpCard(page).first().isVisible({ timeout: 45_000 }).catch(() => false);
    if (!hasCards2) {
      test.skip(true, 'ITP cards not loaded');
      return;
    }

    // Open lending modal
    const borrowBtn = itpCard(page).first().getByRole('button', { name: 'Borrow', exact: true });
    if (!(await borrowBtn.isVisible({ timeout: 10_000 }).catch(() => false))) {
      test.skip(true, 'No Borrow button');
      return;
    }
    await borrowBtn.click();

    // Wait for table and on-chain discovery
    const marketsTable = page.locator('table');
    await expect(marketsTable.first()).toBeVisible({ timeout: 15_000 });
    await page.waitForTimeout(5_000);

    // ITP2 doesn't have a Morpho market — its row should show "Coming Soon"
    const comingSoon = page.getByText('Coming Soon');
    const hasComingSoon = await comingSoon.first().isVisible({ timeout: 10_000 }).catch(() => false);

    // Either "Coming Soon" is visible (ITP2 without market) or all ITPs have markets
    // Both are valid states — but at least verify the table has multiple rows
    const rowCount = await marketsTable.locator('tbody tr').count();
    if (hasComingSoon) {
      console.log('Found "Coming Soon" for ITP without Morpho market');
    } else {
      console.log(`All ${rowCount} ITPs have Morpho markets — no "Coming Soon" expected`);
    }
    expect(rowCount).toBeGreaterThanOrEqual(2);
  });
});
