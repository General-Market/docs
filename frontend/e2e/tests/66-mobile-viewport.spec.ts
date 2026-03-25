/**
 * Mobile viewport smoke tests.
 *
 * Verifies the app does not collapse at iPhone 14 widths (375x812).
 * No wallet required — purely structural rendering checks.
 * The Header has a mobile tab strip (md:hidden) and a hamburger menu.
 */
import { test, expect } from '@playwright/test'

const MOBILE = { width: 375, height: 812 }

test.describe('Mobile Viewport Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(MOBILE)
  })

  test('homepage renders source cards and mobile nav at 375px', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 })

    // Mobile tab strip renders below header (md:hidden element with nav buttons)
    // The hamburger button is inside a div.md\\:hidden — visible at 375px
    const hamburger = page.locator('div.md\\:hidden button').first()
    await expect(hamburger).toBeVisible({ timeout: 15_000 })

    // Source cards should render — they stack vertically on mobile
    const sourceCards = page.locator('[data-testid="source-card"], a[href*="/source/"]')
    await expect(sourceCards.first()).toBeVisible({ timeout: 30_000 })
    const count = await sourceCards.count()
    expect(count).toBeGreaterThan(0)

    // Page should not overflow horizontally (a common mobile breakage)
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    expect(bodyWidth).toBeLessThanOrEqual(MOBILE.width + 5) // small tolerance
  })

  test('index page renders ITP content at mobile width', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/index', { waitUntil: 'domcontentloaded', timeout: 60_000 })

    // Wait for ITP content to appear — table or card layout
    const hasContent = await page
      .locator('text=/Markets|ITP|NAV|Index/i')
      .first()
      .isVisible({ timeout: 30_000 })
      .catch(() => false)
    expect(hasContent).toBe(true)

    // ITP cards should be present
    const itpCards = page.locator('[id^="itp-card-"]')
    let cardsVisible = await itpCards.first().isVisible({ timeout: 30_000 }).catch(() => false)
    if (!cardsVisible) {
      // Data-node may be slow — retry navigation
      await page.goto('/index', { waitUntil: 'domcontentloaded', timeout: 60_000 })
      cardsVisible = await itpCards.first().isVisible({ timeout: 30_000 }).catch(() => false)
    }
    expect(cardsVisible).toBe(true)

    // No horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    expect(bodyWidth).toBeLessThanOrEqual(MOBILE.width + 5)
  })

  test('source detail page renders batch panel at mobile width', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/source/coingecko', { waitUntil: 'domcontentloaded', timeout: 60_000 })

    // Source name should appear
    const heading = page.locator('h1, h2').filter({ hasText: /CoinGecko/i })
    await expect(heading.first()).toBeVisible({ timeout: 30_000 })

    // Batch entry panel should be usable — look for "Set predictions" or "Enter Batch" or "Connect Wallet"
    const batchPanel = page.locator('text=/Set predictions|Enter Batch|Connect Wallet|Add Funds/i')
    const panelVisible = await batchPanel.first().isVisible({ timeout: 15_000 }).catch(() => false)
    // Panel may not be visible if no active batch — that is acceptable on testnet
    if (panelVisible) {
      // Verify the stake input is not clipped off-screen
      const stakeInput = page.locator('input[placeholder*="0"]').first()
      if (await stakeInput.isVisible({ timeout: 3_000 }).catch(() => false)) {
        const box = await stakeInput.boundingBox()
        if (box) {
          expect(box.x).toBeGreaterThanOrEqual(0)
          expect(box.x + box.width).toBeLessThanOrEqual(MOBILE.width + 5)
        }
      }
    }

    // No horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    expect(bodyWidth).toBeLessThanOrEqual(MOBILE.width + 5)
  })

  test('about page renders at mobile width without overflow', async ({ page }) => {
    test.setTimeout(120_000)
    await page.goto('/about', { waitUntil: 'domcontentloaded', timeout: 60_000 })

    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 15_000 })

    // Hamburger visible, desktop nav hidden
    const hamburger = page.locator('div.md\\:hidden button').first()
    await expect(hamburger).toBeVisible({ timeout: 10_000 })

    const bodyWidth = await page.evaluate(() => document.body.scrollWidth)
    expect(bodyWidth).toBeLessThanOrEqual(MOBILE.width + 5)
  })
})
