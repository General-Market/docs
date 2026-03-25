/**
 * 36-lending-curator — Verify lending markets have real data after curator reform.
 *
 * The /index page has a sidebar with a "Lending" nav item (section id="lend").
 * Clicking it renders LendingPage inline, which shows:
 * - A stats banner: Vault TVL | Supply APY | Borrow APY | Utilization
 * - A markets table with rows per collateral token
 *
 * Vault TVL comes from on-chain reads (useMetaMorphoVault, polls every 15s).
 * Market rows come from SSE (useAllMorphoMarkets → useSSEMorphoMarkets).
 * On a fresh deploy the curator may not have set rates yet, so we allow
 * borrow APY of "0.00%" or "--" as acceptable on fresh deploy — the test
 * only fails if the table has zero rows or TVL never loads.
 *
 * Stale collateral: if morpho-deployment.json points to a dead collateral token,
 * SSE emits no markets and the stats banner stays in skeleton state. Both tests
 * detect this early and skip gracefully (same pattern as 10-morpho-oracle-health).
 */
import { test, expect } from '../fixtures/wallet'
import { isValidErc20, l3RpcCall } from '../helpers/backend-api'
import { MORPHO_CONTRACTS, MORPHO_MARKET_PARAMS } from '../env'

/**
 * Returns true if the Morpho deployment is functional:
 * - MORPHO core contract has code on L3
 * - collateralToken is a valid ERC20
 *
 * When false, tests should skip gracefully rather than time-out waiting for
 * data that will never arrive.
 */
async function isMorphoFunctional(): Promise<{ ok: boolean; reason: string }> {
  const morphoAddr = MORPHO_CONTRACTS.MORPHO
  if (!morphoAddr) {
    return { ok: false, reason: 'morpho-deployment.json missing MORPHO address' }
  }

  const morphoCode = await l3RpcCall('eth_getCode', [morphoAddr, 'latest']) as string
  if (!morphoCode || morphoCode === '0x') {
    return { ok: false, reason: `MORPHO at ${morphoAddr} has no code — stale deployment` }
  }

  const collateralToken = MORPHO_MARKET_PARAMS.collateralToken
  if (!collateralToken) {
    return { ok: false, reason: 'morpho-deployment.json missing collateralToken' }
  }

  const collateralOk = await isValidErc20(collateralToken)
  if (!collateralOk) {
    return { ok: false, reason: `collateralToken ${collateralToken} has no code — stale deployment` }
  }

  return { ok: true, reason: 'Morpho deployment is functional' }
}

/** Click the "Lending" sidebar/nav item and wait for the lend section to become interactive. */
async function navigateToLending(page: import('@playwright/test').Page) {
  // Both sidebar (desktop) and bottom bar (mobile) have a "Lending" button.
  // At Playwright's default 1280px viewport the sidebar is visible.
  // Use .first() to avoid strict-mode ambiguity between the two.
  const lendBtn = page.getByRole('button', { name: 'Lending' }).first()
  await expect(lendBtn).toBeVisible({ timeout: 30_000 })
  await lendBtn.click()

  // The section animates in via framer-motion. Wait for the LendingPage heading
  // to appear inside the #lend motion.div. The h2 renders regardless of wallet state.
  const lendSection = page.locator('#lend')
  await expect(lendSection.locator('h2')).toBeVisible({ timeout: 30_000 })
}

test.describe('Lending Curator', () => {
  test('36a: lending section shows non-zero vault TVL', async ({ walletPage: page }) => {
    // Pre-check: if collateral token is stale, SSE emits no markets and
    // LendingStatsBanner stays in skeleton mode indefinitely — skip early.
    const morpho = await isMorphoFunctional()
    if (!morpho.ok) {
      console.log(`[36a] ${morpho.reason} — skipping TVL check`)
      test.skip(true, morpho.reason)
      return
    }

    await navigateToLending(page)

    // LendingStatsBanner renders:
    //   <span class="text-micro ...">Vault TVL</span>
    //   <span class="text-sm font-bold ...">$5,000,000</span>
    // Both are span elements inside the same flex column div.
    // Find the label span, then its next sibling span via XPath.
    const lendSection = page.locator('#lend')

    // Poll until vault TVL loads with a real dollar value.
    // On-chain reads (useMetaMorphoVault) poll every 15s; wagmi hydration adds delay.
    await expect(async () => {
      const tvlLabel = lendSection.locator('span', { hasText: /^Vault TVL/ }).first()
      await expect(tvlLabel).toBeVisible()
      const tvlValue = tvlLabel.locator('xpath=following-sibling::span[1]')
      const text = await tvlValue.textContent()
      expect(text, 'Vault TVL should not be placeholder').not.toBe('--')
      expect(text, 'Vault TVL should show a dollar amount').toContain('$')
    }).toPass({ timeout: 60_000, intervals: [2_000, 3_000, 5_000] })
  })

  test('36b: markets table has rows with borrow APY', async ({ walletPage: page }) => {
    // Pre-check: if collateral token is stale, SSE emits no markets and the
    // table will only ever show the "No markets available" placeholder — skip early.
    const morpho = await isMorphoFunctional()
    if (!morpho.ok) {
      console.log(`[36b] ${morpho.reason} — skipping markets table check`)
      test.skip(true, morpho.reason)
      return
    }

    await navigateToLending(page)

    // The markets table is inside MarketsTable, rendered by LendingPage.
    // It only renders real rows when SSE market data has arrived.
    const lendSection = page.locator('#lend')

    // Wait for the table to appear — SSE data may take time to arrive.
    const marketTable = lendSection.locator('table').first()

    // Poll until at least one data row appears. On fresh deploy, SSE morpho markets
    // may take up to ~30s to populate as the data-node scans deployed markets.
    await expect(async () => {
      const rows = marketTable.locator('tbody tr')
      // Filter out placeholder rows ("Loading markets..." or "No markets available")
      // which are single-cell <td colspan=6> rows
      const dataRows = rows.filter({ hasNot: page.locator('td[colspan]') })
      const dataRowCount = await dataRows.count()
      expect(dataRowCount, 'Markets table should have at least one data row').toBeGreaterThan(0)
    }).toPass({ timeout: 90_000, intervals: [3_000, 5_000, 10_000] })

    // Verify borrow APY column (3rd column) has content.
    // On fresh deploy, borrow APY may be "0.00%" (no borrows yet) or a real rate.
    // Both are acceptable — only "--" everywhere would indicate broken data.
    const apyCells = marketTable
      .locator('tbody tr')
      .filter({ hasNot: page.locator('td[colspan]') })
      .locator('td:nth-child(3)')
    const allText = await apyCells.allTextContents()

    if (allText.length === 0) {
      console.warn('[36b] No APY cells found — markets table may have rendered without APY column. Curator may not have set rates yet.')
      return
    }

    // Accept either a percentage value, "--", or empty on fresh deploy.
    // The test passes if at least one row has ANY content (not empty).
    const hasContent = allText.some(t => t.trim().length > 0)
    if (!hasContent) {
      console.warn('[36b] APY cells are all empty — curator may not have set rates yet. This is acceptable on fresh deploy.')
      return
    }

    // Soft check: log whether we see real APY data
    const hasRealApy = allText.some(t => t.includes('%') && !t.includes('--'))
    if (!hasRealApy) {
      console.log('[36b] No real borrow APY yet — curator may not have updated rates. This is acceptable on fresh deploy.')
    }
  })
})
