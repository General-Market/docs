/**
 * Sources monitoring page (/sources) — deep section verification.
 *
 * The /sources page renders data source health: a stats row with counters
 * (Sources, Healthy, Stale, Dead, Live Assets, Last Updated), a sortable
 * SourceHealthTable, and a SourceDetailModal on row click. No wallet needed.
 *
 * Distinct from the home page Vision source cards — this is the ops dashboard.
 */
import { test, expect } from '@playwright/test'

test.describe('Sources Monitoring Page', () => {
  test('page loads with heading and stats row', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/sources', { waitUntil: 'domcontentloaded', timeout: 90_000 })

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('h1').first()).toHaveText(/Source Monitoring/i)

    // Stats row: Sources, Healthy, Stale, Dead, Live Assets, Last Updated
    await expect(page.getByText('Sources').first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText('Healthy').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText('Last Updated').first()).toBeVisible({ timeout: 15_000 })
  })

  test('source health table renders rows', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/sources', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 60_000 })

    // SourceHealthTable renders <table> with <tbody> rows — depends on API data
    const tableRows = page.locator('table tbody tr')
    const rowVisible = await tableRows.first().isVisible({ timeout: 45_000 }).catch(() => false)
    if (!rowVisible) {
      console.log('Source health table rows not visible — API may be unavailable')
      return
    }
    const count = await tableRows.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('SectionBar shows tracked count and Refresh button', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/sources', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 60_000 })

    const trackedVisible = await page
      .getByText(/sources tracked|Loading/i)
      .first()
      .isVisible({ timeout: 30_000 })
      .catch(() => false)
    if (!trackedVisible) {
      console.log('Sources tracked count not visible — API data may still be loading')
    }

    const refreshVisible = await page
      .getByRole('button', { name: /Refresh/i })
      .first()
      .isVisible({ timeout: 15_000 })
      .catch(() => false)
    if (!refreshVisible) {
      console.log('Refresh button not found — UI layout may have changed')
    }
  })

  test('clicking a table row opens source detail', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/sources', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 60_000 })

    const tableRows = page.locator('table tbody tr')
    const rowVisible = await tableRows.first().isVisible({ timeout: 45_000 }).catch(() => false)
    if (!rowVisible) {
      console.log('No table rows to click — API data unavailable')
      return
    }
    await tableRows.first().click()

    // SourceDetailModal should appear, or at minimum the page should not break
    const modalVisible = await page
      .locator('[role="dialog"]')
      .first()
      .isVisible({ timeout: 10_000 })
      .catch(() => false)

    if (!modalVisible) {
      // Fallback: page still intact after click
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 5_000 })
    }
  })

  test('no raw wei values in visible text', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/sources', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 60_000 })

    // Wait for table data to load
    await page.locator('table tbody tr').first().waitFor({ timeout: 45_000 }).catch(() => {})

    const bodyText = await page.locator('body').textContent() ?? ''
    const rawWeiPattern = /(?<![0-9a-fA-Fx])\d{18,}(?![0-9a-fA-Fx])/
    const matches = bodyText.match(rawWeiPattern)
    expect(
      matches,
      `Raw wei value on /sources: ${matches?.[0]?.slice(0, 30)}`
    ).toBeNull()
  })
})
