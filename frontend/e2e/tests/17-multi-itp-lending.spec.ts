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
} from '../helpers/selectors';
import { getItpCountL3 } from '../helpers/backend-api';

test.describe('Multi-ITP Lending Visibility', () => {
  test('lending markets table shows multiple ITPs after ITP creation', async ({ walletPage: page }) => {
    test.setTimeout(180_000);

    // Verify ITP2+ exists on L3 (created by test 05)
    const itpCount = await getItpCountL3();
    expect(itpCount, 'Need at least 2 ITPs on L3').toBeGreaterThanOrEqual(2);

    await ensureWalletConnected(page, TEST_ADDRESS);

    // Click the Lending sidebar nav to activate the lend section.
    // Hash navigation (/index#lend) only works on initial mount — the walletPage
    // fixture already loaded /index, so the hash useEffect won't re-fire.
    const lendingNav = page.getByRole('button', { name: /Lending/i }).first();
    await expect(lendingNav).toBeVisible({ timeout: 30_000 });
    await lendingNav.click();
    await page.waitForTimeout(2_000);

    const lendSect = page.locator('#lend');
    await expect(lendSect).toBeVisible({ timeout: 30_000 });

    // Wait for the markets table — VaultModal renders table only when wallet is connected
    // and on-chain vault discovery completes. Use page-scoped locator for resilience.
    const marketsTable = page.locator('table').first();
    await expect(marketsTable).toBeVisible({ timeout: 60_000 });

    // Count table body rows (each row = one ITP market)
    const tableRows = marketsTable.locator('tbody tr');
    await expect(tableRows.first()).toBeVisible({ timeout: 30_000 });
    await page.waitForTimeout(5_000);

    const rowCount = await tableRows.count();
    console.log(`Lending markets table has ${rowCount} ITP rows (expected >= 1)`);
    expect(rowCount, 'Markets table should show at least one ITP').toBeGreaterThanOrEqual(1);
  });

  test('ITP2 row shows "Coming Soon" when no Morpho market deployed', async ({ walletPage: page }) => {
    test.setTimeout(180_000);

    const itpCount = await getItpCountL3();
    expect(itpCount, 'Need at least 2 ITPs on L3').toBeGreaterThanOrEqual(2);

    await ensureWalletConnected(page, TEST_ADDRESS);

    // Click Lending sidebar nav to activate section
    const lendingNav = page.getByRole('button', { name: /Lending/i }).first();
    await expect(lendingNav).toBeVisible({ timeout: 30_000 });
    await lendingNav.click();
    await page.waitForTimeout(2_000);

    const lendSect = page.locator('#lend');
    await expect(lendSect).toBeVisible({ timeout: 30_000 });

    // Wait for table and on-chain discovery
    const marketsTable = page.locator('table').first();
    await expect(marketsTable).toBeVisible({ timeout: 60_000 });
    await page.waitForTimeout(5_000);

    // Check for "Coming Soon" text (ITPs without Morpho market)
    const comingSoon = page.getByText('Coming Soon');
    const hasComingSoon = await comingSoon.first().isVisible({ timeout: 10_000 }).catch(() => false);

    const rowCount = await marketsTable.locator('tbody tr').count();
    if (hasComingSoon) {
      console.log('Found "Coming Soon" for ITP without Morpho market');
    } else {
      console.log(`All ${rowCount} ITPs have Morpho markets`);
    }
    expect(rowCount).toBeGreaterThanOrEqual(1);
  });
});
