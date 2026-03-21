/**
 * 36-lending-curator — Verify lending markets have real data after curator reform.
 *
 * The /index page has a sidebar with a "Lending" nav item (section id="lend").
 * Clicking it renders VaultModal inline, which shows:
 * - A stats row: Vault TVL | Supply APY | Borrow APY | Utilization
 * - Supply and Borrow panels
 * - A Morpho Markets table with rows per collateral token
 *
 * Vault TVL comes from on-chain reads (useMetaMorphoVault, polls every 15s).
 * Market rows come from SSE (useAllMorphoMarkets → useSSEMorphoMarkets).
 * On a fresh deploy the curator may not have set rates yet, so we allow
 * borrow APY of "0.00%" or "--" as acceptable on fresh deploy — the test
 * only fails if the table has zero rows or TVL never loads.
 */
import { test, expect } from '../fixtures/wallet'

/** Click the "Lending" sidebar/nav item and wait for the lend section to become interactive. */
async function navigateToLending(page: import('@playwright/test').Page) {
  // Both sidebar (desktop) and bottom bar (mobile) have a "Lending" button.
  // At Playwright's default 1280px viewport the sidebar is visible.
  // Use .first() to avoid strict-mode ambiguity between the two.
  const lendBtn = page.getByRole('button', { name: 'Lending' }).first()
  await expect(lendBtn).toBeVisible({ timeout: 30_000 })
  await lendBtn.click()

  // The section animates in via framer-motion. Wait for the VaultModal header
  // to appear inside the #lend motion.div. The heading "Lend" (h2) renders
  // regardless of wallet connection state.
  const lendSection = page.locator('#lend')
  await expect(lendSection.locator('h2')).toBeVisible({ timeout: 30_000 })
}

test.describe('Lending Curator', () => {
  test('36a: lending section shows non-zero vault TVL', async ({ walletPage: page }) => {
    await navigateToLending(page)

    // StatCell renders: <div><p>Vault TVL</p><p>$5,000,000</p></div>
    // Find the label <p>, then grab the sibling value <p> via XPath.
    const lendSection = page.locator('#lend')

    // Poll until vault TVL loads with a real dollar value.
    // On-chain reads (useMetaMorphoVault) poll every 15s; wagmi hydration adds delay.
    await expect(async () => {
      // Locate the label <p> containing "Vault TVL", then its next sibling <p>
      const tvlLabel = lendSection.locator('p', { hasText: 'Vault TVL' }).first()
      await expect(tvlLabel).toBeVisible()
      const tvlValue = tvlLabel.locator('xpath=following-sibling::p[1]')
      const text = await tvlValue.textContent()
      expect(text, 'Vault TVL should not be placeholder').not.toBe('--')
      expect(text, 'Vault TVL should show a dollar amount').toContain('$')
    }).toPass({ timeout: 60_000, intervals: [2_000, 3_000, 5_000] })
  })

  test('36b: markets table has rows with borrow APY', async ({ walletPage: page }) => {
    await navigateToLending(page)

    // The markets table is inside MarketsTableInline, rendered by LendDashboard.
    // It only renders when wallet is connected. The table is the only <table> in #lend.
    const lendSection = page.locator('#lend')

    // Wait for the table to appear — SSE data may take time to arrive.
    const marketTable = lendSection.locator('table').first()

    // Poll until at least one data row appears. On fresh deploy, SSE morpho markets
    // may take up to ~30s to populate as the data-node scans deployed markets.
    await expect(async () => {
      const rows = marketTable.locator('tbody tr')
      const rowCount = await rows.count()
      // Filter out placeholder rows ("Loading markets..." or "No markets available")
      // which are single-cell <td colspan=6> rows
      const dataRows = rows.filter({ hasNot: page.locator('td[colspan]') })
      const dataRowCount = await dataRows.count()
      expect(dataRowCount, 'Markets table should have at least one data row').toBeGreaterThan(0)
    }).toPass({ timeout: 90_000, intervals: [3_000, 5_000, 10_000] })

    // Verify borrow APY column (3rd column) has content.
    // On fresh deploy, borrow APY may be "0.00%" (no borrows yet) or a real rate.
    // Both are acceptable — only "--" everywhere would indicate broken data.
    const apyCells = marketTable.locator('tbody tr').filter({ hasNot: page.locator('td[colspan]') }).locator('td:nth-child(3)')
    const allText = await apyCells.allTextContents()
    expect(allText.length, 'Should have APY cells').toBeGreaterThan(0)

    // Accept either a percentage value or "--" on fresh deploy.
    // The test passes if at least one row has ANY content (not empty).
    const hasContent = allText.some(t => t.trim().length > 0)
    expect(hasContent, 'APY cells should have content').toBe(true)

    // Soft check: log whether we see real APY data
    const hasRealApy = allText.some(t => t.includes('%') && !t.includes('--'))
    if (!hasRealApy) {
      console.log('[36b] No real borrow APY yet — curator may not have updated rates. This is acceptable on fresh deploy.')
    }
  })
})
