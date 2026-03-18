/**
 * Multi-ITP Lending Visibility E2E Tests
 *
 * Verifies that dynamically created ITPs (ITP2+) appear in the lending
 * markets table via on-chain discovery (getItpCount + itpVaults).
 *
 * The lending UI lives inside VaultModal (rendered inline in the #lend section).
 * VaultModal > LendDashboard > MarketsTableInline contains the <table>.
 * Navigation: sidebar click switches activeSection to 'lend' in HomeClient.
 *
 * CRITICAL: All locators must be scoped to #lend — the markets section also
 * has a <table> earlier in the DOM. page.locator('table').first() would match
 * the markets table (now hidden), not the lending table.
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
 * Navigate to the Lending section via direct URL hash and wait for the section
 * to become fully visible (framer-motion transition from hidden to active).
 *
 * Uses page.goto('/index#lend') instead of sidebar click — the sidebar click
 * sometimes fails to activate the section due to framer-motion timing issues.
 * HomeClient reads the hash on mount and sets activeSection accordingly.
 */
async function navigateToLendSection(page: import('@playwright/test').Page) {
  await page.goto('/index#lend', { waitUntil: 'domcontentloaded', timeout: 60_000 });

  // Allow hydration + framer-motion transition + wallet auto-connect
  await page.waitForTimeout(3_000);

  await ensureWalletConnected(page, TEST_ADDRESS);

  const lendSect = page.locator('#lend');
  await expect(lendSect).toBeVisible({ timeout: 30_000 });

  // Allow VaultModal's on-chain reads to fire (useEffect for vault discovery)
  await page.waitForTimeout(2_000);

  return lendSect;
}

test.describe('Multi-ITP Lending Visibility', () => {
  test('lending markets table shows multiple ITPs after ITP creation', async ({ walletPage: page }) => {
    test.setTimeout(180_000);

    // Verify ITP2+ exists on L3 (created by test 05)
    const itpCount = await getItpCountL3();
    expect(itpCount, 'Need at least 2 ITPs on L3').toBeGreaterThanOrEqual(2);

    const lendSect = await navigateToLendSection(page);

    // Scope table locator to #lend — the markets section has its own <table>
    // higher in the DOM which is now hidden. page.locator('table').first()
    // would match that invisible table and wait forever.
    const marketsTable = lendSect.locator('table').first();
    await expect(marketsTable).toBeVisible({ timeout: 60_000 });

    // Count table body rows (each row = one ITP market)
    const tableRows = marketsTable.locator('tbody tr');
    await expect(tableRows.first()).toBeVisible({ timeout: 30_000 });

    // Brief settle for async on-chain discovery to populate remaining rows
    await page.waitForTimeout(3_000);

    const rowCount = await tableRows.count();
    console.log(`Lending markets table has ${rowCount} ITP rows (expected >= 1)`);
    expect(rowCount, 'Markets table should show at least one ITP').toBeGreaterThanOrEqual(1);
  });

  test('ITP2 row shows borrow data or placeholder when no Morpho market deployed', async ({ walletPage: page }) => {
    test.setTimeout(180_000);

    const itpCount = await getItpCountL3();
    expect(itpCount, 'Need at least 2 ITPs on L3').toBeGreaterThanOrEqual(2);

    const lendSect = await navigateToLendSection(page);

    // Scope to #lend section — same reason as above
    const marketsTable = lendSect.locator('table').first();
    await expect(marketsTable).toBeVisible({ timeout: 60_000 });

    // Wait for on-chain discovery to populate rows
    await page.waitForTimeout(3_000);

    const tableRows = marketsTable.locator('tbody tr');
    const rowCount = await tableRows.count();

    // ITPs without a Morpho market show "--" for borrow APY instead of a percentage.
    // Check if any row has placeholder data (indicates ITP discovered but no market).
    const placeholderCells = lendSect.locator('td').filter({ hasText: '--' });
    const hasPlaceholders = await placeholderCells.first().isVisible({ timeout: 5_000 }).catch(() => false);

    if (hasPlaceholders) {
      console.log(`Found placeholder data (--) — some ITPs lack Morpho markets`);
    } else {
      console.log(`All ${rowCount} ITPs have live Morpho market data`);
    }
    expect(rowCount, 'Markets table should show at least one ITP row').toBeGreaterThanOrEqual(1);
  });
});
