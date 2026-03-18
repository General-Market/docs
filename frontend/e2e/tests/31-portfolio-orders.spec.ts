/**
 * Portfolio tabs E2E.
 * Phase: write-after (order cancellation writes on-chain)
 */
import { test, expect, TEST_ADDRESS } from '../fixtures/wallet'
import { ensureWalletConnected } from '../helpers/selectors'

/** Navigate to Portfolio section via sidebar or hash */
async function navigateToPortfolio(page: import('@playwright/test').Page) {
  // Portfolio is behind sidebar navigation — use #portfolio hash to activate it
  await page.goto('/index#portfolio', { waitUntil: 'domcontentloaded', timeout: 60_000 })
  await page.waitForTimeout(3_000)
}

test.describe('Portfolio & Orders', () => {
  test('Portfolio section shows tabs', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    await navigateToPortfolio(page)
    await ensureWalletConnected(page, TEST_ADDRESS)

    const positionsTab = page.getByRole('button', { name: /Positions/i }).first()
    await expect(positionsTab).toBeVisible({ timeout: 15_000 })
  })

  test('Positions tab shows formatted values', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    await navigateToPortfolio(page)
    await ensureWalletConnected(page, TEST_ADDRESS)

    const positionsTab = page.getByRole('button', { name: /Positions/i }).first()
    let hasTab = await positionsTab.isVisible({ timeout: 15_000 }).catch(() => false)
    if (!hasTab) {
      // Retry with fresh navigation
      await navigateToPortfolio(page)
      await ensureWalletConnected(page, TEST_ADDRESS)
      hasTab = await positionsTab.isVisible({ timeout: 30_000 }).catch(() => false)
    }
    expect(hasTab).toBe(true)
    await positionsTab.click()

    // Should contain dollar amounts or share counts, not raw 18-digit numbers
    await expect(async () => {
      const text = await page.locator('body').textContent()
      expect(text).not.toMatch(/\d{18,}/)
    }).toPass({ timeout: 15_000 })
  })

  test('Trades tab renders', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    await navigateToPortfolio(page)
    await ensureWalletConnected(page, TEST_ADDRESS)

    const tradesTab = page.getByRole('button', { name: /Trades/i }).first()
    let hasTab = await tradesTab.isVisible({ timeout: 15_000 }).catch(() => false)
    if (!hasTab) {
      // Retry with fresh navigation
      await navigateToPortfolio(page)
      await ensureWalletConnected(page, TEST_ADDRESS)
      hasTab = await tradesTab.isVisible({ timeout: 30_000 }).catch(() => false)
    }
    expect(hasTab).toBe(true)
    await tradesTab.click()

    // Tab rendered — content may be empty if no trades. Assert tab didn't crash.
    await page.waitForTimeout(3_000)
    const bodyText = await page.locator('body').textContent()
    // No raw wei in trade amounts
    expect(bodyText).not.toMatch(/\d{18,}/)
  })
})
