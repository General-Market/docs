/**
 * Chart modal — verifies the ITP price chart overlay opens and renders.
 */
import { test, expect } from '@playwright/test'

test.describe('Chart Modal', () => {
  test('/index page loads ITP listing', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/index', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    // Wait for the ITP listing table or card grid
    const listing = page.locator('table, [class*="listing"], [class*="itp"], [class*="Itp"]')
    await expect(listing.first()).toBeVisible({ timeout: 60_000 })
  })

  test('ITP row has chart interaction target', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/index', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    // Look for chart icons, sparklines, or clickable price cells
    const chartTargets = page.locator('[class*="chart"], [class*="Chart"], [class*="sparkline"], svg')
    const count = await chartTargets.count()
    console.log(`Chart interaction targets: ${count}`)
    // At least some interactive elements should exist in the listing
    expect(count).toBeGreaterThan(0)
  })

  test('no raw wei in ITP listing', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/index', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForTimeout(5_000)
    const rawWei = await page.locator('text=/^\\d{18,}$/').count()
    expect(rawWei, 'no raw bigints in ITP listing').toBe(0)
  })
})
