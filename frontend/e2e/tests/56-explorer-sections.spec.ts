/**
 * Explorer page deep section verification — /explorer renders all tabs
 * and summary data without raw wei values leaking into visible text.
 *
 * Test 28 only confirms the page loads. This suite opens each major tab
 * and verifies the corresponding section materializes.
 */
import { test, expect } from '@playwright/test'

test.describe('Explorer Page Sections', () => {
  test('page loads with heading and summary bar', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/explorer', { waitUntil: 'domcontentloaded', timeout: 90_000 })

    // h1 "Explorer"
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('h1').first()).toHaveText(/Explorer/i)

    // Summary bar — six stat cards or the N/A fallback
    const summaryArea = page.locator('.explorer-glass-card, .glass-surface-dark').first()
    await expect(summaryArea).toBeVisible({ timeout: 30_000 })
  })

  test('tab bar renders all expected tabs', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/explorer', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 60_000 })

    // The explorer has 11 tabs
    const expectedTabs = ['Consensus', 'Orders', 'Price Feeds', 'Sources', 'System']
    for (const label of expectedTabs) {
      await expect(page.getByRole('button', { name: label })).toBeVisible({ timeout: 15_000 })
    }
  })

  test('Consensus tab renders section content', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/explorer', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 60_000 })

    // Consensus is the default active tab — section should already be visible
    // Look for consensus-specific labels from the i18n keys
    await expect(
      page.getByText(/Quorum Status|Network Health|Consensus Rounds|Signatures Collected/i).first()
    ).toBeVisible({ timeout: 30_000 })
  })

  test('Orders tab renders section content', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/explorer', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 60_000 })

    await page.getByRole('button', { name: 'Orders' }).click()

    await expect(
      page.getByText(/Pending Orders|Orders Processed|Avg Cycle Duration/i).first()
    ).toBeVisible({ timeout: 30_000 })
  })

  test('Price Feeds tab renders section content', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/explorer', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 60_000 })

    await page.getByRole('button', { name: 'Price Feeds' }).click()

    // PriceFeedSection renders a section with h2 title
    await expect(
      page.locator('section h2, section h3').first()
    ).toBeVisible({ timeout: 30_000 })
  })

  test('Sources tab renders source health stats', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/explorer', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 60_000 })

    await page.getByRole('button', { name: 'Sources' }).click()

    // SourcesExplorerSection renders stat cards: Sources, Healthy, Stale, Dead, Live Assets
    await expect(
      page.getByText(/Healthy|Sources|Dead|Live Assets/i).first()
    ).toBeVisible({ timeout: 30_000 })
  })

  test('no raw wei values in visible text', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/explorer', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 60_000 })

    // Wait for data to load (summary bar or section content)
    await page.waitForTimeout(3_000)

    const bodyText = await page.locator('body').textContent() ?? ''
    // Raw wei = 18+ consecutive digits not inside a hash or address
    // Exclude hex strings (0x...) and timestamps
    const rawWeiPattern = /(?<![0-9a-fA-Fx])\d{18,}(?![0-9a-fA-Fx])/
    const matches = bodyText.match(rawWeiPattern)
    expect(matches, `Raw wei value found in explorer page: ${matches?.[0]?.slice(0, 30)}`).toBeNull()
  })
})
