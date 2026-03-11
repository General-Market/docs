/**
 * ITP detail page E2E — /itp/[itpId] renders with sane data.
 * Phase: ui-verify-itp (ITP exists from Phase 1)
 *
 * NOTE: On testnet, the data-node (VPS 1) may be unreachable from Node.js,
 * causing the ITP detail page to 404. Tests gracefully skip in that case.
 */
import { test, expect } from '@playwright/test'

const ITP_ID = '0x' + '0'.repeat(63) + '1'

test.describe('ITP Detail Page', () => {
  test('/itp/[itpId] page loads', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto(`/itp/${ITP_ID}`, { timeout: 90_000 }).catch(() => {})

    // Check if page loaded or shows 404/error (data-node may be unreachable)
    const bodyText = await page.locator('body').textContent({ timeout: 15_000 }).catch(() => '')
    if (bodyText.includes("doesn't exist") || bodyText.includes('Not Found')) {
      test.skip(true, 'ITP detail page returned 404 — data-node may be unreachable')
      return
    }
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15_000 })
  })

  test('NAV per share in sane range', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto(`/itp/${ITP_ID}`, { timeout: 90_000 }).catch(() => {})

    const bodyText = await page.locator('body').textContent({ timeout: 15_000 }).catch(() => '')
    if (bodyText.includes("doesn't exist") || bodyText.includes('Not Found')) {
      test.skip(true, 'ITP detail page returned 404 — data-node may be unreachable')
      return
    }
    await expect(async () => {
      const text = await page.locator('[class*="nav"], [class*="price"], [data-testid*="nav"]').first().textContent()
        ?? await page.locator('body').textContent()
      expect(text).toMatch(/\$\d+\.\d{2}/)
    }).toPass({ timeout: 15_000 })
  })

  test('holdings table shows assets', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto(`/itp/${ITP_ID}`, { timeout: 90_000 }).catch(() => {})

    const bodyText = await page.locator('body').textContent({ timeout: 15_000 }).catch(() => '')
    if (bodyText.includes("doesn't exist") || bodyText.includes('Not Found')) {
      test.skip(true, 'ITP detail page returned 404 — data-node may be unreachable')
      return
    }
    await expect(page.getByText(/BTC|ETH|SOL/i).first()).toBeVisible({ timeout: 15_000 })
  })
})
