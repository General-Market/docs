/**
 * Points page smoke test — /points renders without crashing.
 * No wallet connection required.
 */
import { test, expect } from '@playwright/test'

test.describe('Points Page', () => {
  test('page loads without crash', async ({ page }) => {
    test.setTimeout(120_000)

    const response = await page.goto('/points', { waitUntil: 'domcontentloaded', timeout: 60_000 })

    expect(response?.status()).toBeLessThan(500)
    await expect(page.locator('main')).toBeVisible({ timeout: 60_000 })
  })

  test('points heading or main content visible', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/points', { waitUntil: 'domcontentloaded', timeout: 60_000 })

    // The hero section renders an h1 — either the points total (if connected)
    // or the title text (if not). Either way, an h1 must exist.
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 60_000 })
  })

  test('how-it-works steps render', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/points', { waitUntil: 'domcontentloaded', timeout: 60_000 })

    await expect(page.locator('main')).toBeVisible({ timeout: 60_000 })

    // The three-step "how it works" section renders step numbers 01, 02, 03
    await expect(async () => {
      const bodyText = await page.locator('body').textContent() ?? ''
      expect(bodyText).toContain('01')
      expect(bodyText).toContain('02')
      expect(bodyText).toContain('03')
    }).toPass({ timeout: 30_000 })
  })

  test('leaderboard table renders', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/points', { waitUntil: 'domcontentloaded', timeout: 60_000 })

    await expect(page.locator('main')).toBeVisible({ timeout: 60_000 })

    // Leaderboard has a <table> element — either with rows or a loading/empty state
    await expect(async () => {
      const tables = page.locator('table')
      const count = await tables.count()
      expect(count).toBeGreaterThanOrEqual(1)
    }).toPass({ timeout: 30_000 })
  })

  test('no 500 error', async ({ page }) => {
    test.setTimeout(120_000)

    const response = await page.goto('/points', { waitUntil: 'domcontentloaded', timeout: 60_000 })

    expect(response?.status()).toBeLessThan(500)

    await expect(page.locator('main')).toBeVisible({ timeout: 60_000 })
    const bodyText = await page.locator('body').textContent() ?? ''
    expect(bodyText).not.toContain('Application error')
    expect(bodyText).not.toContain('Internal Server Error')
  })

  test('no raw wei/bigint values visible', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/points', { waitUntil: 'domcontentloaded', timeout: 60_000 })

    await expect(page.locator('main')).toBeVisible({ timeout: 60_000 })

    await page.waitForTimeout(3_000)
    const rawWeiCount = await page.locator('text=/\\d{18,}/').count()
    expect(rawWeiCount).toBe(0)
  })
})
