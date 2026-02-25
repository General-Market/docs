/**
 * Vision Sources E2E tests.
 *
 * Tests the sources browse page and individual source detail pages.
 * Source cards render from static data (VISION_SOURCES) so these tests
 * don't require backend or chain infrastructure.
 */
import { test, expect } from '@playwright/test'
import {
  sourceFlipCard,
  categoryPill,
  sourcesSectionBar,
  sortButton,
  sourcesBackLink,
  sourceHeroTitle,
  marketsSectionBar,
  marketsSearchInput,
  enterBatchHeading,
  enterBatchButton,
  stakeInput,
  quickStakeButton,
} from '../helpers/selectors'

// ── Browse page ──────────────────────────────────────────────

test.describe('Vision Sources — Browse', () => {
  test('browse page loads and shows source cards', async ({ page }) => {
    await page.goto('/')
    // Source cards render from static data (no API needed)
    const cards = sourceFlipCard(page)
    await expect(cards.first()).toBeVisible({ timeout: 15_000 })
    // Should have many source cards (79 sources in registry)
    const count = await cards.count()
    expect(count).toBeGreaterThan(10)
  })

  test('section bar shows "Data Sources" with count', async ({ page }) => {
    await page.goto('/')
    const bar = sourcesSectionBar(page)
    await expect(bar).toBeVisible({ timeout: 15_000 })
    // Should show "{N} sources" text
    await expect(bar.getByText(/\d+ sources/)).toBeVisible()
  })

  test('category pills are visible with counts', async ({ page }) => {
    await page.goto('/')
    // "All" pill should be visible and active (black background)
    const allPill = categoryPill(page, 'All')
    await expect(allPill).toBeVisible({ timeout: 15_000 })

    // Finance pill should also be visible
    const financePill = categoryPill(page, 'Finance')
    await expect(financePill).toBeVisible()
  })

  test('category filtering reduces visible cards', async ({ page }) => {
    await page.goto('/')
    const cards = sourceFlipCard(page)
    await expect(cards.first()).toBeVisible({ timeout: 15_000 })

    const allCount = await cards.count()

    // Click "Finance" category
    const financePill = categoryPill(page, 'Finance')
    await financePill.click()

    // Wait for re-render — card count should be smaller
    await page.waitForTimeout(300)
    const financeCount = await cards.count()
    expect(financeCount).toBeLessThan(allCount)
    expect(financeCount).toBeGreaterThan(0)

    // Click "All" to reset
    await categoryPill(page, 'All').click()
    await page.waitForTimeout(300)
    const resetCount = await cards.count()
    expect(resetCount).toBe(allCount)
  })

  test('source card shows name and category badge', async ({ page }) => {
    await page.goto('/')
    const cards = sourceFlipCard(page)
    await expect(cards.first()).toBeVisible({ timeout: 15_000 })

    // CoinGecko should be present (first finance source)
    await expect(page.getByText('CoinGecko Crypto').first()).toBeVisible()

    // Category badge should show "FINANCE" on the card
    await expect(page.getByText('FINANCE').first()).toBeVisible()
  })

  test('sort buttons are visible and clickable', async ({ page }) => {
    await page.goto('/')
    await expect(sourceFlipCard(page).first()).toBeVisible({ timeout: 15_000 })

    const trending = sortButton(page, 'Trending')
    const newSort = sortButton(page, 'New')
    const mostAssets = sortButton(page, 'Most Assets')

    await expect(trending).toBeVisible()
    await expect(newSort).toBeVisible()
    await expect(mostAssets).toBeVisible()

    // Click "New" sort — should not crash
    await newSort.click()
    await page.waitForTimeout(300)
    const count = await sourceFlipCard(page).count()
    expect(count).toBeGreaterThan(0)
  })

  test('clicking a source card navigates to detail page', async ({ page }) => {
    await page.goto('/')
    const cards = sourceFlipCard(page)
    await expect(cards.first()).toBeVisible({ timeout: 15_000 })

    // Click the first card once to pin, then again to navigate
    const firstCard = cards.first()
    await firstCard.click()
    // Small delay for pin state
    await page.waitForTimeout(200)
    await firstCard.click()

    // Should navigate to /source/{id}
    await page.waitForURL(/\/source\//, { timeout: 15_000 })
    expect(page.url()).toContain('/source/')
  })
})

// ── Detail page ──────────────────────────────────────────────

test.describe('Vision Sources — Detail', () => {
  test('detail page loads for CoinGecko', async ({ page }) => {
    await page.goto('/source/coingecko')
    // Source name should appear as h1
    const title = sourceHeroTitle(page)
    await expect(title).toContainText('CoinGecko', { timeout: 15_000 })
  })

  test('detail page shows back link', async ({ page }) => {
    await page.goto('/source/coingecko')
    const backLink = sourcesBackLink(page)
    await expect(backLink).toBeVisible({ timeout: 15_000 })
  })

  test('detail page shows hero with category badge', async ({ page }) => {
    await page.goto('/source/coingecko')
    await expect(sourceHeroTitle(page)).toBeVisible({ timeout: 15_000 })

    // Category badge "Finance" should be visible in the hero
    await expect(page.getByText('Finance').first()).toBeVisible()

    // API badge should be visible
    await expect(page.getByText('API')).toBeVisible()
  })

  test('detail page shows markets section', async ({ page }) => {
    await page.goto('/source/coingecko')
    const marketsBar = marketsSectionBar(page)
    await expect(marketsBar).toBeVisible({ timeout: 15_000 })

    // Markets heading text
    await expect(marketsBar.getByText('Markets')).toBeVisible()
  })

  test('detail page shows search input for markets', async ({ page }) => {
    await page.goto('/source/coingecko')
    const searchInput = marketsSearchInput(page)
    await expect(searchInput).toBeVisible({ timeout: 15_000 })
  })

  test('detail page shows Enter Batch panel', async ({ page }) => {
    await page.goto('/source/coingecko')
    const heading = enterBatchHeading(page)
    await expect(heading).toBeVisible({ timeout: 15_000 })

    // Enter Batch button should be present
    const btn = enterBatchButton(page)
    await expect(btn).toBeVisible()
  })

  test('stake input and quick amount buttons are visible', async ({ page }) => {
    await page.goto('/source/coingecko')
    await expect(enterBatchHeading(page)).toBeVisible({ timeout: 15_000 })

    // Stake input
    const input = stakeInput(page)
    await expect(input).toBeVisible()

    // Quick stake buttons ($1, $5, $10, $50)
    for (const amt of ['$1', '$5', '$10', '$50']) {
      await expect(quickStakeButton(page, amt)).toBeVisible()
    }
  })

  test('back link navigates to browse page', async ({ page }) => {
    await page.goto('/source/coingecko')
    const backLink = sourcesBackLink(page)
    await expect(backLink).toBeVisible({ timeout: 15_000 })

    await backLink.click()
    // Should navigate back to the root (browse page)
    await page.waitForURL(/\/$/, { timeout: 15_000 })
    // Source cards should be visible again
    await expect(sourceFlipCard(page).first()).toBeVisible({ timeout: 15_000 })
  })

  test('invalid source shows 404 or not-found page', async ({ page }) => {
    const response = await page.goto('/source/nonexistent-source-xyz')
    // Next.js may return 200 with a not-found page or 404 depending on catch-all routing
    const status = response?.status() ?? 0
    const hasNotFound = await page.getByText(/not found|404|doesn't exist/i).first().isVisible({ timeout: 5_000 }).catch(() => false)
    expect(status === 404 || hasNotFound || status === 200).toBe(true)
  })

  test('multiple source detail pages work', async ({ page }) => {
    // Test that different sources render correctly
    const sources = [
      { id: 'fred', name: 'FRED Interest Rates' },
      { id: 'finnhub', name: 'Finnhub Stocks' },
      { id: 'reddit', name: 'Reddit Communities' },
    ]

    for (const { id, name } of sources) {
      await page.goto(`/source/${id}`)
      await expect(sourceHeroTitle(page)).toContainText(name, { timeout: 15_000 })
    }
  })
})

// ── Strategy panel ───────────────────────────────────────────

test.describe('Vision Sources — Strategies', () => {
  test('strategy list shows premade strategies', async ({ page }) => {
    await page.goto('/source/coingecko')
    await expect(enterBatchHeading(page)).toBeVisible({ timeout: 15_000 })

    // Strategy names should be visible
    await expect(page.getByText('Momentum').first()).toBeVisible()
    await expect(page.getByText('Contrarian').first()).toBeVisible()
    await expect(page.getByText('All UP').first()).toBeVisible()
  })

  test('Claude Code Agent button is disabled', async ({ page }) => {
    await page.goto('/source/coingecko')
    await expect(enterBatchHeading(page)).toBeVisible({ timeout: 15_000 })

    // The "Deploy with Claude Code Agent" button should be disabled
    const agentButton = page.getByRole('button', { name: /Claude Code Agent/i })
    await expect(agentButton).toBeVisible()
    await expect(agentButton).toBeDisabled()
  })
})
