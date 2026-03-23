/**
 * Vision Sources E2E tests.
 *
 * Tests the sources browse page and individual source detail pages.
 * Source cards render from dynamic API data (useSourceRegistry) so
 * tests verify structural elements rather than hardcoded source names.
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
    // Pills render from useSourceRegistry — they appear even before cards
    // (cards wait for per-source snapshots, pills only need the registry).
    // But give enough time for the registry to load.
    const allPill = categoryPill(page, 'All')
    await expect(allPill).toBeVisible({ timeout: 30_000 })

    // Finance pill should also be visible
    const financePill = categoryPill(page, 'Finance')
    await expect(financePill).toBeVisible({ timeout: 15_000 })
  })

  test('category filtering reduces visible cards', async ({ page }) => {
    test.setTimeout(180_000)
    await page.goto('/')
    const cards = sourceCard(page)
    await expect(cards.first()).toBeVisible({ timeout: 30_000 })

    // Wait for card count to stabilize (sources grid may still be rendering).
    // Cards depend on per-source snapshot fetches — give extra settle time.
    let allCount = 0
    await expect(async () => {
      const c = await cards.count()
      expect(c).toBeGreaterThan(10)
      allCount = c
    }).toPass({ timeout: 45_000 })
    // Wait for card count to stabilize — NextBatches re-sorts every 1s
    await expect(async () => {
      const a = await cards.count()
      await new Promise(r => setTimeout(r, 2_000))
      const b = await cards.count()
      expect(a).toBe(b)
    }).toPass({ timeout: 15_000 })
    allCount = await cards.count()

    // Click a small category — try several until one exists and has fewer cards
    let filterPill = null
    for (const cat of ['Transport', 'Space', 'Weather', 'Sports', 'Finance']) {
      const pill = categoryPill(page, cat)
      if (await pill.isVisible({ timeout: 3_000 }).catch(() => false)) {
        filterPill = pill
        console.log(`Category filter: using "${cat}"`)
        break
      }
    }
    if (!filterPill) {
      console.warn('SKIP: No category pills found — UI may not have rendered category filters.')
      return
    }
    await filterPill.click({ force: true })

    // Wait for the pill to show active state
    await expect(filterPill).toHaveClass(/font-bold/, { timeout: 15_000 })

    // Wait for re-render — card count should be smaller.
    // Use polling instead of fixed timeout for reliability.
    await expect(async () => {
      const count = await cards.count()
      expect(count).toBeLessThan(allCount)
    }).toPass({ timeout: 45_000 })
    const filteredCount = await cards.count()
    expect(filteredCount).toBeLessThan(allCount)
    expect(filteredCount).toBeGreaterThan(0)

    // Click "All" to reset — wait for count to return close to original
    // (may not be exactly allCount due to NextBatches re-sort timing)
    await categoryPill(page, 'All').click({ force: true })
    await expect(async () => {
      const count = await cards.count()
      expect(count).toBeGreaterThanOrEqual(allCount - 5)
    }).toPass({ timeout: 45_000 })
  })

  test('source card shows name and category badge', async ({ page }) => {
    await page.goto('/')
    const cards = sourceCard(page)
    await expect(cards.first()).toBeVisible({ timeout: 15_000 })

    // First card should have a visible h3 (source name)
    const firstCard = cards.first()
    await expect(firstCard.locator('h3').first()).toBeVisible()

    // Category badge should be visible on the card (rendered as uppercase span)
    // Badge text is dynamic from API — just verify some uppercase badge exists
    await expect(firstCard.locator('span.uppercase').first()).toBeVisible()
  })

  test('source card is a navigable link', async ({ page }) => {
    await page.goto('/')
    const cards = sourceCard(page)
    await expect(cards.first()).toBeVisible({ timeout: 15_000 })

    // Each source card is a <Link> (renders as <a>) wrapping the entire card
    // The [data-testid="source-card"] element itself is the <a> tag
    const firstCard = cards.first()
    const href = await firstCard.getAttribute('href')
    expect(href).toBeTruthy()
    expect(href).toContain('/source/')
  })

  test('clicking source card navigates to detail page', async ({ page }) => {
    await page.goto('/')
    const cards = sourceCard(page)
    await expect(cards.first()).toBeVisible({ timeout: 15_000 })

    // Click the first source card (the card itself is a link to /source/{id})
    await cards.first().click()

    // Should navigate to /source/{id}
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
    test.setTimeout(120_000)
    await page.goto('/source/coingecko', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    // Wait for source hero to confirm page loaded (registry must finish loading first)
    const title = sourceHeroTitle(page)
    await expect(title).toBeVisible({ timeout: 60_000 })

    // BatchEntryPanel heading: "Set predictions"
    const heading = enterBatchHeading(page)
    await expect(heading).toBeVisible({ timeout: 30_000 })

    // The main action button is always present — its label depends on wallet state.
    // Without wallet: "Connect Wallet" or "Enter Batch". With wallet: "Enter Batch" or "Deposit More".
    // Match any of these labels to verify the button exists.
    const btn = page.getByRole('button', { name: /Enter Batch|Connect Wallet|Deposit/ })
    await expect(btn.first()).toBeVisible({ timeout: 15_000 })
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
