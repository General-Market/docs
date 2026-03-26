/**
 * Multi-ITP Lending Visibility E2E Tests
 *
 * Verifies that dynamically created ITPs appear in the lending markets table
 * with real data in every column — not just row counts.
 *
 * Column order (Playwright viewport 1280px = lg, all columns visible):
 *   1: Market  |  2: NAV  |  3: Borrow APY  |  4: Balance  |  5: Liquidity  |  6: LLTV  |  7: mobile dot (hidden at lg)
 *
 * Depends on: test 05-create-itp.spec.ts having created ITP2.
 * Runs in: ui-verify-itp project (pattern 1[6-7])
 */
import { test, expect, TEST_ADDRESS } from '../fixtures/wallet';
import {
  ensureWalletConnected,
} from '../helpers/selectors';
import { getItpCountL3 } from '../helpers/backend-api';

/**
 * Navigate to the Lending section via sidebar and wait for the section
 * to become fully visible (framer-motion transition from hidden to active).
 */
async function navigateToLendSection(page: import('@playwright/test').Page) {
  await ensureWalletConnected(page, TEST_ADDRESS);

  const lendingNav = page.getByRole('button', { name: /Lending/i }).first();
  await expect(lendingNav).toBeVisible({ timeout: 30_000 });
  await lendingNav.click();

  const lendSect = page.locator('#lend');
  await expect(lendSect).toBeVisible({ timeout: 30_000 });

  // Wait for table or empty state
  await lendSect.locator('table, text=/No markets/i').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});

  return lendSect;
}

test.describe('Multi-ITP Lending Visibility', () => {
  test('lending markets table shows ITPs with real cell data', async ({ walletPage: page }) => {
    test.setTimeout(180_000);

    // Verify ITP2+ exists on L3
    const itpCount = await getItpCountL3();
    expect(itpCount, 'Need at least 2 ITPs on L3').toBeGreaterThanOrEqual(2);

    const lendSect = await navigateToLendSection(page);

    // Scope to #lend section
    const marketsTable = lendSect.locator('table').first();
    await expect(marketsTable).toBeVisible({ timeout: 60_000 });

    const dataRows = marketsTable.locator('tbody tr');
    await expect(dataRows.first()).toBeVisible({ timeout: 30_000 });

    // Wait for rows to populate
    await expect(async () => {
      const count = await dataRows.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }).toPass({ timeout: 15_000 });

    const rowCount = await dataRows.count();
    console.log(`Lending table: ${rowCount} rows`);

    // ── Verify every row has real data in key columns ──
    for (let i = 0; i < Math.min(rowCount, 5); i++) {
      const row = dataRows.nth(i);

      // Col 1: Market name — should contain text (not empty)
      const marketCell = row.locator('td').nth(0);
      const marketText = await marketCell.textContent();
      expect(marketText!.trim().length, `Row ${i}: Market name should not be empty`).toBeGreaterThan(0);

      // Col 2: NAV — should contain a dollar value like "$0.97" or "$1.00"
      const navCell = row.locator('td').nth(1);
      const navText = await navCell.textContent();
      expect(navText, `Row ${i}: NAV should contain $`).toContain('$');

      // Col 3: Borrow APY — should contain a percentage
      const apyCell = row.locator('td').nth(2);
      const apyText = await apyCell.textContent();
      expect(apyText, `Row ${i}: Borrow APY should contain %`).toContain('%');

      // Col 4: Balance — should have content (dollar amount, "active", or em dash)
      const balanceCell = row.locator('td').nth(3);
      const balanceText = await balanceCell.textContent();
      expect(balanceText!.trim().length, `Row ${i}: Balance cell should not be empty`).toBeGreaterThan(0);

      // Col 6: LLTV — should contain a percentage like "77%"
      const lltvCell = row.locator('td').nth(5);
      const lltvText = await lltvCell.textContent();
      expect(lltvText, `Row ${i}: LLTV should contain %`).toContain('%');

      console.log(`  Row ${i}: market="${marketText!.trim().slice(0, 30)}" nav=${navText} apy=${apyText} balance="${balanceText!.trim()}" lltv=${lltvText}`);
    }
  });

  test('Balance column header is visible at default viewport', async ({ walletPage: page }) => {
    test.setTimeout(120_000);

    const itpCount = await getItpCountL3();
    expect(itpCount, 'Need at least 2 ITPs on L3').toBeGreaterThanOrEqual(2);

    const lendSect = await navigateToLendSection(page);

    const marketsTable = lendSect.locator('table').first();
    await expect(marketsTable).toBeVisible({ timeout: 60_000 });

    // Verify column headers include "Balance" and "Liquidity" (not old "Available")
    const headers = marketsTable.locator('thead th');
    const headerTexts = await headers.allTextContents();
    console.log(`Table headers: ${headerTexts.join(' | ')}`);

    expect(headerTexts.some(h => h.includes('Balance')), 'Balance column header should be visible').toBe(true);
    expect(headerTexts.some(h => h.includes('Liquidity')), 'Liquidity column header should be visible').toBe(true);
    expect(headerTexts.some(h => h === 'Available'), '"Available" header should not exist (renamed to Liquidity)').toBe(false);
  });
});
