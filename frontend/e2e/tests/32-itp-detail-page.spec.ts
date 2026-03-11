/**
 * ITP detail page E2E — /itp/[itpId] renders with sane data.
 * Phase: ui-verify-itp (ITP exists from Phase 1)
 */
import { test, expect } from '@playwright/test'

const ITP_ID = '0x' + '0'.repeat(63) + '1'

test.describe('ITP Detail Page', () => {
  test('/itp/[itpId] page loads', async ({ page }) => {
    await page.goto(`/itp/${ITP_ID}`)
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 15_000 })
  })

  test('NAV per share in sane range', async ({ page }) => {
    await page.goto(`/itp/${ITP_ID}`)
    await expect(async () => {
      const text = await page.locator('body').textContent()
      expect(text).toMatch(/\$\d+\.\d{2}/)
      expect(text).not.toMatch(/\d{18,}/)
    }).toPass({ timeout: 15_000 })
  })

  test('holdings table shows assets', async ({ page }) => {
    await page.goto(`/itp/${ITP_ID}`)
    await expect(page.getByText(/BTC|ETH|SOL/i).first()).toBeVisible({ timeout: 15_000 })
  })
})
