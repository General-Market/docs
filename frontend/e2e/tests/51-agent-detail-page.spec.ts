/**
 * Agent detail page smoke test — /agent/[address] renders without crashing.
 * No wallet connection required. Uses Anvil deployer address.
 */
import { test, expect } from '@playwright/test'

const TEST_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

test.describe('Agent Detail Page', () => {
  test('page loads without crash', async ({ page }) => {
    test.setTimeout(180_000)

    // Capture console errors and response status
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    const response = await page.goto(`/agent/${TEST_ADDRESS}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })

    // 404 is acceptable (no agent data for this address) — only server errors are failures
    expect(response?.status()).toBeLessThan(500)

    await expect(page.locator('main')).toBeVisible({ timeout: 60_000 })
  })

  test('agent header renders with address', async ({ page }) => {
    test.setTimeout(180_000)
    await page.goto(`/agent/${TEST_ADDRESS}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })

    await expect(page.locator('main')).toBeVisible({ timeout: 60_000 })

    // HeroBand renders the full address as subtitle and truncated as title.
    // Verify the address appears somewhere on the page.
    await expect(async () => {
      const bodyText = await page.locator('body').textContent() ?? ''
      const hasAddress = bodyText.includes('0xf39F') || bodyText.includes(TEST_ADDRESS)
      expect(hasAddress).toBe(true)
    }).toPass({ timeout: 30_000 })
  })

  test('performance section or empty state renders', async ({ page }) => {
    test.setTimeout(180_000)
    await page.goto(`/agent/${TEST_ADDRESS}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })

    await expect(page.locator('main')).toBeVisible({ timeout: 60_000 })

    // The page shows either performance stats (SectionBar + StatCards)
    // or a "no data" / loading state. Either is acceptable.
    await expect(async () => {
      const bodyText = await page.locator('body').textContent() ?? ''
      // Look for stat-related text (ROI, PnL, Win Rate) or empty/loading state
      const hasStats = /roi|pnl|win.?rate|volume/i.test(bodyText)
      const hasEmptyState = /no.?data|loading/i.test(bodyText)
      const hasSkeletons = await page.locator('.animate-pulse').count() > 0
      expect(hasStats || hasEmptyState || hasSkeletons).toBe(true)
    }).toPass({ timeout: 30_000 })
  })

  test('no raw wei/bigint values visible', async ({ page }) => {
    test.setTimeout(180_000)
    await page.goto(`/agent/${TEST_ADDRESS}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })

    await expect(page.locator('main')).toBeVisible({ timeout: 60_000 })

    await page.waitForTimeout(3_000)
    const rawWeiCount = await page.locator('text=/\\d{18,}/').count()
    expect(rawWeiCount).toBe(0)
  })

  test('no 500 error on page', async ({ page }) => {
    test.setTimeout(180_000)

    const response = await page.goto(`/agent/${TEST_ADDRESS}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })

    // 404 is acceptable (no agent data) — only 5xx indicates a real failure
    expect(response?.status()).toBeLessThan(500)

    // Also check that no error boundary or Next.js error overlay rendered
    await expect(page.locator('main')).toBeVisible({ timeout: 60_000 })
    const bodyText = await page.locator('body').textContent() ?? ''
    expect(bodyText).not.toContain('Application error')
    expect(bodyText).not.toContain('Internal Server Error')
  })
})
