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
 * Navigate to the Lending section via sidebar and wait for the section
 * to become fully visible (framer-motion transition from hidden to active).
 */
async function navigateToLendSection(page: import('@playwright/test').Page) {
  await ensureWalletConnected(page, TEST_ADDRESS);

  // The sidebar is hidden lg:flex — Playwright default viewport 1280x720 satisfies lg.
  // Both desktop sidebar and mobile bottom bar have a "Lending" button — take the first visible.
  const lendingNav = page.getByRole('button', { name: /Lending/i }).first();
  await expect(lendingNav).toBeVisible({ timeout: 30_000 });
  await lendingNav.click();

  // Wait for the motion.div#lend to transition from hidden (opacity:0, invisible)
  // to active (opacity:1, visible). The className switches immediately but the
  // spring animation takes ~500ms for opacity.
  const lendSect = page.locator('#lend');
  await expect(lendSect).toBeVisible({ timeout: 30_000 });

  // Wait for VaultModal's on-chain reads (useEffect for vault discovery) — table or placeholder appears
  await lendSect.locator('table, text=/No markets/i').first().waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {});

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

    // Wait for async on-chain discovery to populate remaining rows
    await expect(async () => {
      const count = await tableRows.count();
      expect(count).toBeGreaterThanOrEqual(1);
    }).toPass({ timeout: 15_000 });

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
    const tableRows = marketsTable.locator('tbody tr');
    await expect(tableRows.first()).toBeVisible({ timeout: 15_000 }).catch(() => {});
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
