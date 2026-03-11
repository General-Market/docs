/**
 * Portfolio tabs E2E.
 * Phase: write-after (order cancellation writes on-chain)
 */
import { test, expect, TEST_ADDRESS } from '../fixtures/wallet'
import { ensureWalletConnected } from '../helpers/selectors'

test.describe('Portfolio & Orders', () => {
  test('Portfolio section shows tabs', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    await page.goto('/index')
    await ensureWalletConnected(page, TEST_ADDRESS)

    await page.evaluate(() => {
      const headings = document.querySelectorAll('h2')
      for (const h of headings) {
        if (h.textContent?.includes('Portfolio')) {
          h.scrollIntoView()
          break
        }
      }
    })

    const positionsTab = page.getByRole('button', { name: /Positions/i }).first()
    await expect(positionsTab).toBeVisible({ timeout: 15_000 })
  })

  test('Positions tab shows formatted values', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    await page.goto('/index')
    await ensureWalletConnected(page, TEST_ADDRESS)

    const positionsTab = page.getByRole('button', { name: /Positions/i }).first()
    const hasTab = await positionsTab.isVisible({ timeout: 15_000 }).catch(() => false)
    if (!hasTab) {
      test.skip(true, 'Portfolio section not visible')
      return
    }
    await positionsTab.click()

    // Should contain dollar amounts or share counts, not raw 18-digit numbers
    await expect(async () => {
      const text = await page.locator('body').textContent()
      expect(text).not.toMatch(/\d{18,}/)
    }).toPass({ timeout: 15_000 })
  })

  test('Trades tab renders', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    await page.goto('/index')
    await ensureWalletConnected(page, TEST_ADDRESS)

    const tradesTab = page.getByRole('button', { name: /Trades/i }).first()
    const hasTab = await tradesTab.isVisible({ timeout: 15_000 }).catch(() => false)
    if (!hasTab) {
      test.skip(true, 'Trades tab not visible')
      return
    }
    await tradesTab.click()

    // Tab rendered — content may be empty if no trades. Assert tab didn't crash.
    await page.waitForTimeout(3_000)
    const bodyText = await page.locator('body').textContent()
    // No raw wei in trade amounts
    expect(bodyText).not.toMatch(/\d{18,}/)
  })
})
