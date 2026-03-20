/**
 * 36-lending-curator — Verify lending markets have real data after curator reform.
 */
import { test, expect } from '../fixtures/wallet'

test.describe('Lending Curator', () => {
  test('36a: lending section shows non-zero vault TVL', async ({ walletPage: page }) => {
    const lendBtn = page.locator('button:has-text("Lending")')
    await expect(lendBtn).toBeVisible({ timeout: 15_000 })
    await lendBtn.click()
    await page.waitForTimeout(2000)

    const lendSect = page.locator('#lend')
    await expect(lendSect).toBeVisible({ timeout: 30_000 })

    const tvlCell = lendSect.locator('text=/Vault TVL/').locator('..').locator('p')
    await expect(tvlCell).not.toHaveText('--', { timeout: 30_000 })
  })

  test('36b: markets table has rows with borrow APY', async ({ walletPage: page }) => {
    const lendBtn = page.locator('button:has-text("Lending")')
    await expect(lendBtn).toBeVisible({ timeout: 15_000 })
    await lendBtn.click()

    const lendSect = page.locator('#lend')
    await expect(lendSect).toBeVisible({ timeout: 30_000 })

    const marketTable = lendSect.locator('table').first()
    await expect(marketTable).toBeVisible({ timeout: 30_000 })

    const rows = marketTable.locator('tbody tr')
    await expect(rows.first()).toBeVisible({ timeout: 30_000 })
    const rowCount = await rows.count()
    expect(rowCount, 'Markets table should have rows').toBeGreaterThan(0)

    const apyCells = marketTable.locator('tbody tr td:nth-child(3)')
    const allText = await apyCells.allTextContents()
    const hasRealApy = allText.some(t => t.includes('%') && !t.includes('--'))
    expect(hasRealApy, 'At least one market should show real borrow APY').toBe(true)
  })
})
