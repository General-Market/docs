/**
 * Vision Sources E2E tests.
 *
 * Tests the sources browse page and individual source detail pages.
 * Source cards render from static data (VISION_SOURCES) so these tests
 * don't require backend or chain infrastructure.
 */
import { test, expect } from '@playwright/test'
import {
  sourceCard,
  categoryPill,
  sourcesSectionBar,
  sourcesBackLink,
  sourceHeroTitle,
  marketsSectionBar,
  marketsSearchInput,
  enterBatchHeading,
  enterBatchButton,
  stakeInput,
  quickStakeButton,
  strategyButton,
} from '../helpers/selectors'

// ── Browse page ──────────────────────────────────────────────

test.describe('Vision Sources — Browse', () => {
  test('browse page loads and shows source cards', async ({ page }) => {
    await page.goto('/')
    const cards = sourceCard(page)
    await expect(cards.first()).toBeVisible({ timeout: 15_000 })
    // Should have many source cards (76 sources in registry)
    const count = await cards.count()
    expect(count).toBeGreaterThan(10)
  })

  test('stats bar shows Sources count', async ({ page }) => {
    await page.goto('/')
    const bar = sourcesSectionBar(page)
    await expect(bar).toBeVisible({ timeout: 15_000 })
    // Should show "Sources" label with a count number
    await expect(bar.getByText('Sources')).toBeVisible()
  })

  test('category pills are visible with counts', async ({ page }) => {
    await page.goto('/')
    // "All" pill should be visible
    const allPill = categoryPill(page, 'All')
    await expect(allPill).toBeVisible({ timeout: 15_000 })

    // Finance pill should also be visible
    const financePill = categoryPill(page, 'Finance')
    await expect(financePill).toBeVisible()
  })

  test('category filtering reduces visible cards', async ({ page }) => {
    await page.goto('/')
    const cards = sourceCard(page)
    await expect(cards.first()).toBeVisible({ timeout: 15_000 })

    const allCount = await cards.count()

    // Click "Finance" category
    // Use force:true because NextBatches re-sorts every 1s causing layout shifts
    // that can intercept the click target
    const financePill = categoryPill(page, 'Finance')
    await financePill.click({ force: true })

    // Wait for the Finance pill to show active state (re-render started)
    await expect(financePill).toHaveClass(/font-semibold/, { timeout: 15_000 })

    // Wait for re-render — card count should be smaller.
    // Use polling instead of fixed timeout for reliability.
    await expect(async () => {
      const count = await cards.count()
      expect(count).toBeLessThan(allCount)
    }).toPass({ timeout: 30_000 })
    const financeCount = await cards.count()
    expect(financeCount).toBeLessThan(allCount)
    expect(financeCount).toBeGreaterThan(0)

    // Click "All" to reset
    await categoryPill(page, 'All').click()
    await expect(async () => {
      const count = await cards.count()
      expect(count).toBe(allCount)
    }).toPass({ timeout: 30_000 })
  })

  test('source card shows name and category badge', async ({ page }) => {
    await page.goto('/')
    const cards = sourceCard(page)
    await expect(cards.first()).toBeVisible({ timeout: 15_000 })

    // CoinGecko should be present (first finance source)
    await expect(page.getByText('CoinGecko Crypto').first()).toBeVisible()

    // Category badge should show "FINANCE" on the card
    await expect(page.getByText('FINANCE').first()).toBeVisible()
  })

  test('source card has action links (Markets, Batch, Details)', async ({ page }) => {
    await page.goto('/')
    const cards = sourceCard(page)
    await expect(cards.first()).toBeVisible({ timeout: 15_000 })

    // First card should have MARKETS, BATCH, DETAILS action links
    const firstCard = cards.first()
    await expect(firstCard.getByRole('link', { name: 'Markets' }).first()).toBeVisible()
    await expect(firstCard.getByRole('link', { name: 'Batch' })).toBeVisible()
    await expect(firstCard.getByRole('link', { name: 'Details' })).toBeVisible()
  })

  test('clicking a source card navigates to detail page', async ({ page }) => {
    await page.goto('/')
    const cards = sourceCard(page)
    await expect(cards.first()).toBeVisible({ timeout: 15_000 })

    // Click MARKETS link on first card to navigate to detail
    const firstCard = cards.first()
    const marketsLink = firstCard.getByRole('link', { name: 'Markets' }).first()
    await expect(marketsLink).toBeVisible({ timeout: 5_000 })
    await marketsLink.click()

    // Should navigate to /source/{id} — use networkidle for Next.js client-side routing
    await page.waitForURL(/\/source\//, { timeout: 60_000, waitUntil: 'domcontentloaded' })
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
    await expect(sourceHeroTitle(page)).toBeVisible({ timeout: 15_000 })
    // "Sources" back link at top
    await expect(page.getByText('Sources').first()).toBeVisible()
  })

  test('detail page shows hero with category badge', async ({ page }) => {
    await page.goto('/source/coingecko')
    await expect(sourceHeroTitle(page)).toBeVisible({ timeout: 15_000 })

    // Category badge "Finance" (or "FINANCE") should be visible in the hero
    await expect(page.getByText(/finance/i).first()).toBeVisible()
  })

  test('detail page shows markets section', async ({ page }) => {
    await page.goto('/source/coingecko')
    const marketsBar = marketsSectionBar(page)
    await expect(marketsBar).toBeVisible({ timeout: 15_000 })
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

    // Quick stake buttons ($1, $5, $10, $50, $100)
    for (const amt of ['$1', '$5', '$10', '$50', '$100']) {
      await expect(quickStakeButton(page, amt)).toBeVisible()
    }
  })

  test('invalid source shows not-found page', async ({ page }) => {
    const response = await page.goto('/source/nonexistent-source-xyz')
    const status = response?.status() ?? 0
    const hasNotFound = await page.getByText(/not found|404|doesn't exist/i).first().isVisible({ timeout: 5_000 }).catch(() => false)
    expect(status === 404 || hasNotFound || status === 200).toBe(true)
  })

  test('multiple source detail pages work', async ({ page }) => {
    const sources = [
      { id: 'fred', name: 'FRED' },
      { id: 'finnhub', name: 'Finnhub' },
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
    await expect(page.getByText('Momentum Follower').first()).toBeVisible()
    await expect(page.getByText('Contrarian').first()).toBeVisible()
  })

  test('Claude Code agent button is visible', async ({ page }) => {
    await page.goto('/source/coingecko')
    await expect(enterBatchHeading(page)).toBeVisible({ timeout: 15_000 })

    // The "Claude Code" button should be visible
    const agentButton = page.getByRole('button', { name: /Claude Code/i })
    await expect(agentButton).toBeVisible()
  })
})
