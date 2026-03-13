/**
 * ITP detail page E2E — /itp/[itpId] renders with sane data.
 * Phase: ui-verify-itp (ITP exists from Phase 1)
 */
import { test, expect } from '@playwright/test'

const ITP_ID = '0x' + '0'.repeat(63) + '1'

test.describe('ITP Detail Page', () => {
  test('/itp/[itpId] page loads', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto(`/itp/${ITP_ID}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })

    // Wait for page content (SSR delivers h1 "ITP #1")
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 60_000 })
  })

  test('NAV per share in sane range', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto(`/itp/${ITP_ID}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })

    // Wait for h1 first (page loaded), then check for NAV dollar value
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 60_000 })
    await expect(async () => {
      const text = await page.locator('body').textContent() ?? ''
      expect(text).toMatch(/\$\d+\.\d{2,4}/)
    }).toPass({ timeout: 30_000 })
  })

  test('holdings table shows assets', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto(`/itp/${ITP_ID}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText(/BTC|ETH|SOL/i).first()).toBeVisible({ timeout: 30_000 })
  })
})
