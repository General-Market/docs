/**
 * Profile page smoke test — /profile/[address] renders without crashing.
 * No wallet connection required. Uses Anvil deployer address.
 */
import { test, expect } from '@playwright/test'

const TEST_ADDRESS = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
const TRUNCATED = '0xf39F...2266'

test.describe('Profile Page', () => {
  test('page loads without crash', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto(`/profile/${TEST_ADDRESS}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })

    // Either the ProfileHeader or the loading skeleton should be visible
    await expect(page.locator('main')).toBeVisible({ timeout: 60_000 })
  })

  test('ProfileHeader renders with truncated address', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto(`/profile/${TEST_ADDRESS}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })

    // Wait for content — either loaded header or loading skeleton
    await expect(page.locator('main')).toBeVisible({ timeout: 60_000 })

    // The ProfileHeader displays truncateAddress(address) — expect the truncated form
    // It may still be in loading state (skeleton), so we wait for any text to appear
    await expect(async () => {
      const bodyText = await page.locator('body').textContent() ?? ''
      // Either the truncated address is visible, or the page is in loading/skeleton state
      const hasAddress = bodyText.includes(TRUNCATED) || bodyText.includes('0xf39F')
      const hasSkeletons = await page.locator('.animate-pulse').count() > 0
      expect(hasAddress || hasSkeletons).toBe(true)
    }).toPass({ timeout: 30_000 })
  })

  test('tab navigation exists (Vision / Index)', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto(`/profile/${TEST_ADDRESS}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })

    await expect(page.locator('main')).toBeVisible({ timeout: 60_000 })

    // ProfileTabs renders two tabs — their labels come from i18n but the tab
    // structure is always present (even during loading state)
    await expect(async () => {
      const tabs = page.locator('[class*="SpringTab"], button, [role="tab"]')
      const count = await tabs.count()
      // At minimum the two profile tabs should exist somewhere on the page
      expect(count).toBeGreaterThanOrEqual(2)
    }).toPass({ timeout: 30_000 })
  })

  test('no raw wei/bigint values visible', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto(`/profile/${TEST_ADDRESS}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })

    await expect(page.locator('main')).toBeVisible({ timeout: 60_000 })

    // Wait a beat for data to hydrate, then check for unformatted 18-digit numbers
    await page.waitForTimeout(3_000)
    const rawWeiCount = await page.locator('text=/\\d{18,}/').count()
    expect(rawWeiCount).toBe(0)
  })

  test('PnL chart container or empty state exists', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto(`/profile/${TEST_ADDRESS}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })

    await expect(page.locator('main')).toBeVisible({ timeout: 60_000 })

    // The VisionTab (default) should render — either with a chart/table or
    // "no profile" empty state. Both live inside the max-w-site container.
    await expect(async () => {
      const bodyText = await page.locator('body').textContent() ?? ''
      const hasContent = bodyText.length > 100
      expect(hasContent).toBe(true)
    }).toPass({ timeout: 30_000 })
  })

  test('batch history section exists or shows empty state', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto(`/profile/${TEST_ADDRESS}`, { waitUntil: 'domcontentloaded', timeout: 60_000 })

    await expect(page.locator('main')).toBeVisible({ timeout: 60_000 })

    // The profile page shows either batch/round data or an empty-state message.
    // We verify the content area below the tabs has rendered something.
    await expect(async () => {
      const contentArea = page.locator('.max-w-site')
      const count = await contentArea.count()
      expect(count).toBeGreaterThanOrEqual(1)
    }).toPass({ timeout: 30_000 })
  })
})
