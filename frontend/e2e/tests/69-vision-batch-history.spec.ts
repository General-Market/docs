/**
 * Vision batch history on source detail pages.
 *
 * The BatchHistory component fetches /api/vision/source/{id}/history
 * and renders a "Past Rounds" table with settled batch entries.
 * On testnet the history may be empty — tests handle both states.
 *
 * No wallet required. Tests verify structural rendering and formatting.
 */
import { test, expect } from '@playwright/test'
import { sourceHeroTitle } from '../helpers/selectors'

test.describe('Vision Batch History', () => {
  test('source detail page loads and shows batch history or empty state', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/source/coingecko', { waitUntil: 'domcontentloaded', timeout: 60_000 })

    // Wait for source hero to confirm page loaded
    await expect(sourceHeroTitle(page)).toBeVisible({ timeout: 30_000 })
    await expect(sourceHeroTitle(page)).toContainText('CoinGecko')

    // BatchHistory fetches async — give it time to render or stay hidden (empty)
    const pastRoundsHeader = page.getByText('Past Rounds')
    const hasHistory = await pastRoundsHeader.isVisible({ timeout: 10_000 }).catch(() => false)

    if (hasHistory) {
      // "Past Rounds" section bar should show count like "3 settled"
      await expect(page.getByText(/\d+\s+settled/)).toBeVisible({ timeout: 5_000 })

      // Column headers should be visible
      await expect(page.getByText('Round').first()).toBeVisible()
      await expect(page.getByText('Players').first()).toBeVisible()
      await expect(page.getByText('Pool').first()).toBeVisible()

      // At least one batch row should exist (font-mono round number like #1)
      const batchRows = page.locator('text=/#\\d+/')
      const rowCount = await batchRows.count()
      expect(rowCount).toBeGreaterThan(0)
    }
    // Empty state is valid — BatchHistory returns null when no batches exist
  })

  test('batch history pool values are formatted (no raw wei)', async ({ page }) => {
    test.setTimeout(120_000)

    // Intercept the history API to check response shape
    let historyResponse: { batches: Array<{ totalPool: number }> } | null = null
    page.on('response', async (response) => {
      if (response.url().includes('/api/vision/source/') && response.url().includes('/history')) {
        try {
          historyResponse = await response.json()
        } catch { /* non-JSON response */ }
      }
    })

    await page.goto('/source/coingecko', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await expect(sourceHeroTitle(page)).toBeVisible({ timeout: 30_000 })

    // Wait for history API call
    await page.waitForTimeout(3_000)

    if (historyResponse && (historyResponse as any).batches?.length > 0) {
      const pastRoundsHeader = page.getByText('Past Rounds')
      await expect(pastRoundsHeader).toBeVisible({ timeout: 10_000 })

      // Pool values rendered as "$X.XX" — should never show raw wei (1e18 scale)
      // Grab all text inside the batch history table
      const historySection = page.locator('.section-bar:has-text("Past Rounds")').locator('..')
      const historyText = await historySection.textContent({ timeout: 5_000 })

      // Pool amounts formatted with "$" prefix — no 18-digit raw numbers
      const rawWeiPattern = /\d{15,}/
      expect(historyText).not.toMatch(rawWeiPattern)

      // Should contain at least one dollar-formatted value
      expect(historyText).toMatch(/\$[\d,.]+/)
    }
    // If no batches returned, the component renders nothing — valid on testnet
  })

  test('batch history renders across multiple sources', async ({ page }) => {
    test.setTimeout(120_000)

    // Check two sources — at least one should load a detail page correctly
    for (const source of ['finnhub', 'fred']) {
      await page.goto(`/source/${source}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })

      // Source hero should render with the correct name
      const hero = sourceHeroTitle(page)
      await expect(hero).toBeVisible({ timeout: 30_000 })

      // Page should not crash — main content area has substantial text
      const mainText = await page.locator('main').textContent({ timeout: 10_000 })
      expect(mainText!.length).toBeGreaterThan(50)

      // If Past Rounds is present, verify it has the expected column structure
      const hasPastRounds = await page.getByText('Past Rounds').isVisible({ timeout: 5_000 }).catch(() => false)
      if (hasPastRounds) {
        await expect(page.getByText('Avg P&L').first()).toBeVisible()
        await expect(page.getByText('Settled').first()).toBeVisible()
      }
    }
  })
})
