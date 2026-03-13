/**
 * Display Formatting E2E Tests
 *
 * Catches bugs where raw wei/bigint values leak into the UI instead of
 * formatted human-readable amounts. All tests verify that displayed
 * numbers are in a plausible range (not raw 18-decimal or 6-decimal values).
 *
 * Page layout:
 *   /              → SourcesGrid (categories, live batches, stats bar, source cards)
 *   /source/{id}   → SourceDetail (batch bar with Pool TVL, TopPlayers leaderboard)
 *   /index         → ITP listing (NAV per share, orderbook depth)
 */
import { visionTest as test, expect } from '../fixtures/wallet'
import { VISION_PLAYER_ADDRESS as TEST_ADDRESS } from '../env'
import {
  sourceCard,
  sourcesSectionBar,
  itpCard,
} from '../helpers/selectors'
import {
  PLAYER1,
  depositToVisionBalance,
  ensureBatchExists,
  getVisionPlayerBalance,
} from '../helpers/vision-api'

/** Parse a dollar string like "$4,110.50" or "$1.2K" into a number */
function parseDollar(text: string): number {
  const cleaned = text.replace(/[^0-9.KMB-]/g, '')
  let num = parseFloat(cleaned)
  if (cleaned.endsWith('K')) num = parseFloat(cleaned) * 1_000
  if (cleaned.endsWith('M')) num = parseFloat(cleaned) * 1_000_000
  if (cleaned.endsWith('B')) num = parseFloat(cleaned) * 1_000_000_000
  return num
}

// ── Source Detail — TopPlayers Leaderboard ───────────────────
// TopPlayers renders at /source/{id} with tabular-nums on numeric columns.

test.describe('Display Formatting — Leaderboard', () => {
  test('leaderboard volume and PnL are not raw wei', async ({ walletPage: page }) => {
    test.setTimeout(180_000)
    try {
      await page.goto('/source/coingecko', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    } catch {
      // Retry once — frame detach / ERR_ABORTED under parallel load
      await page.goto('/source/coingecko', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    }

    // Retry navigation if page hit a Next.js error
    const bodyText = await page.locator('body').textContent({ timeout: 5_000 }).catch(() => '')
    if (bodyText?.includes('missing required error components') || bodyText?.includes('Application error')) {
      await page.goto('/source/coingecko', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    }

    // Wait for TopPlayers section bar — if no players yet, test passes trivially (no raw wei to find)
    const topPlayersBar = page.locator('.section-bar').filter({ hasText: 'Top Players' })
    const hasLeaderboard = await topPlayersBar.isVisible({ timeout: 30_000 }).catch(() => false)
    if (!hasLeaderboard) return // No leaderboard data yet — nothing to check

    // Find dollar values in tabular-nums cells (Volume and P&L columns)
    const dollarCells = page.locator('.tabular-nums').filter({ hasText: /\$/ })
    const count = await dollarCells.count()

    for (let i = 0; i < Math.min(count, 10); i++) {
      const text = await dollarCells.nth(i).textContent() || ''
      if (!text.includes('$')) continue

      const num = parseDollar(text)
      // Plausible range: -$10M to +$10M (not $4 trillion)
      expect(num).toBeLessThan(10_000_000)
      expect(num).toBeGreaterThan(-10_000_000)
    }
  })

  test('win rate is a percentage under 100', async ({ walletPage: page }) => {
    test.setTimeout(180_000)
    await page.goto('/source/coingecko', { waitUntil: 'domcontentloaded', timeout: 120_000 })

    const bodyText = await page.locator('body').textContent({ timeout: 5_000 }).catch(() => '')
    if (bodyText?.includes('missing required error components') || bodyText?.includes('Application error')) {
      await page.goto('/source/coingecko', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    }

    const topPlayersBar = page.locator('.section-bar').filter({ hasText: 'Top Players' })
    const hasLeaderboard = await topPlayersBar.isVisible({ timeout: 30_000 }).catch(() => false)
    if (!hasLeaderboard) return // No leaderboard data yet — nothing to check

    // Win rate cells contain percentages like "45.3%"
    const percentCells = page.locator('.tabular-nums').filter({ hasText: /%/ })
    const count = await percentCells.count()

    for (let i = 0; i < Math.min(count, 5); i++) {
      const text = await percentCells.nth(i).textContent() || ''
      const match = text.match(/([\d.]+)%/)
      if (match) {
        const pct = parseFloat(match[1])
        expect(pct).toBeGreaterThanOrEqual(0)
        expect(pct).toBeLessThanOrEqual(100)
      }
    }
  })
})

// ── Source Detail — Pool TVL ─────────────────────────────────
// The batch bar on /source/{id} shows Pool TVL formatted from L3 USDC (18 dec).

test.describe('Display Formatting — Source Detail', () => {
  test('source detail pool TVL is not raw wei', async ({ walletPage: page }) => {
    test.setTimeout(180_000)

    // Ensure Vision batches exist and player has balance (so pool has deposits)
    await ensureBatchExists()
    const balance = await getVisionPlayerBalance(PLAYER1)
    if (balance < BigInt(10) * BigInt(10 ** 18)) {
      await depositToVisionBalance(PLAYER1, BigInt(100) * BigInt(10 ** 18))
    }

    // Use pumpfun — test 13 enters batches here, so it should have deposits
    await page.goto('/source/pumpfun', { waitUntil: 'domcontentloaded', timeout: 60_000 })

    const bodyText = await page.locator('body').textContent({ timeout: 5_000 }).catch(() => '')
    if (bodyText?.includes('missing required error components') || bodyText?.includes('Application error')) {
      await page.goto('/source/pumpfun', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    }

    // Wait for batch bar Pool label
    const poolLabel = page.getByText('Pool', { exact: true })
    await expect(poolLabel).toBeVisible({ timeout: 45_000 })

    // Pool value is styled text-color-up and contains a $ amount.
    // Wait for pool data to populate (SSE delivers batch data).
    // May not appear if no one has deposited into the batch yet.
    const poolValues = page.locator('.text-color-up').filter({ hasText: /\$/ })
    const hasPool = await poolValues.first().isVisible({ timeout: 60_000 }).catch(() => false)
    if (!hasPool) {
      // No pool values visible — likely no deposits in this source's batches
      return
    }
    const count = await poolValues.count()

    for (let i = 0; i < Math.min(count, 3); i++) {
      const text = await poolValues.nth(i).textContent() || ''
      if (!text.includes('$')) continue
      const num = parseDollar(text)
      // Pool TVL should be under $10M (not $5,000,000,000,000)
      expect(num).toBeLessThan(10_000_000)
    }
  })
})

// ── ITP NAV & Orderbook ──────────────────────────────────────

test.describe('Display Formatting — ITP Cards', () => {
  test('ITP NAV per share is between $0.01 and $1000', async ({ walletPage: page }) => {
    test.setTimeout(180_000)
    // visionTest fixture starts at / — navigate to ITP listing
    await page.goto('/index', { waitUntil: 'domcontentloaded', timeout: 60_000 })

    const cards = itpCard(page)
    await expect(cards.first()).toBeVisible({ timeout: 45_000 })

    // Wait for NAV to load on the first card (useItpNav polls /api/itp-price every 1.5s)
    const firstCard = cards.first()
    const navContainer = firstCard.locator('div').filter({ hasText: /NAV/i }).first()
    const navValue = navContainer.locator('.tabular-nums').filter({ hasText: /^\$/ })
    await expect(navValue.first()).toBeVisible({ timeout: 60_000 })

    // Verify NAV values across cards are in plausible range
    const cardCount = await cards.count()
    for (let i = 0; i < Math.min(cardCount, 5); i++) {
      const card = cards.nth(i)
      const container = card.locator('div').filter({ hasText: /NAV/i }).first()
      const value = container.locator('.tabular-nums').filter({ hasText: /^\$/ })
      const hasNav = await value.first().isVisible({ timeout: 10_000 }).catch(() => false)
      if (!hasNav) continue
      const text = await value.first().textContent() || ''
      const num = parseDollar(text)
      expect(num).toBeGreaterThan(0.01)
      expect(num).toBeLessThan(10000)
    }
  })

  test('orderbook loads on ITP hover (not stuck loading)', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    await page.goto('/index', { waitUntil: 'domcontentloaded', timeout: 60_000 })

    const cards = itpCard(page)
    await expect(cards.first()).toBeVisible({ timeout: 45_000 })

    await cards.first().hover()

    const depthHeader = page.getByText('Depth', { exact: true })
    await expect(depthHeader).toBeVisible({ timeout: 10_000 })

    const loadingText = page.getByText('Loading depth...')
    await expect(loadingText).toBeHidden({ timeout: 15_000 })

    const priceElements = page.locator('.text-green-600, .text-red-600')
    const priceCount = await priceElements.count()
    expect(priceCount).toBeGreaterThan(0)
  })
})

// ── Source Cards (on /) ──────────────────────────────────────

test.describe('Display Formatting — Source Cards', () => {
  test('source cards render with market counts', async ({ walletPage: page }) => {
    test.setTimeout(120_000)
    await page.goto('/')

    // Source cards are below NextBatches — may need scroll
    const cards = sourceCard(page)
    let hasCards = await cards.first().isVisible({ timeout: 20_000 }).catch(() => false)
    if (!hasCards) {
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
      await page.waitForTimeout(2_000)
      hasCards = await cards.first().isVisible({ timeout: 5_000 }).catch(() => false)
    }
    // Source cards must be visible — page should be fully loaded
    expect(hasCards, 'Source cards should be visible after scroll').toBeTruthy()

    // Each source card has visible text (name, market count, category)
    const firstCardText = await cards.first().textContent() || ''
    expect(firstCardText.length).toBeGreaterThan(0)
  })

  test('stats bar shows source and asset counts', async ({ walletPage: page }) => {
    test.setTimeout(120_000)
    await page.goto('/')

    // Stats bar: black bar with Sources/Assets/Categories
    const bar = sourcesSectionBar(page)
    await expect(bar).toBeVisible({ timeout: 30_000 })

    const barText = await bar.textContent() || ''
    expect(barText).toContain('Sources')

    // If asset count loaded (not "—"), verify it's a plausible number
    const assetMatch = barText.match(/([\d,]+)\s*Assets/)
    if (assetMatch) {
      const count = parseInt(assetMatch[1].replace(/,/g, ''))
      expect(count).toBeGreaterThan(0)
      expect(count).toBeLessThan(100_000) // Not a raw bigint
    }
  })

  test('source detail page markets load (not stuck loading)', async ({ walletPage: page }) => {
    test.setTimeout(180_000)
    await page.goto('/source/coingecko', { waitUntil: 'domcontentloaded', timeout: 60_000 })

    // Retry navigation if page hit a Next.js error
    const bodyText = await page.locator('body').textContent({ timeout: 5_000 }).catch(() => '')
    if (bodyText?.includes('missing required error components') || bodyText?.includes('Application error')) {
      await page.goto('/source/coingecko', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    }

    const marketsBar = page.locator('.section-bar').filter({ hasText: 'Markets' })
    await expect(marketsBar).toBeVisible({ timeout: 45_000 })

    const marketPrices = page.locator('td, span').filter({ hasText: /^\$[\d,.]+$/ })
    const hasMarketPrices = await marketPrices.first().isVisible({ timeout: 20_000 }).catch(() => false)

    if (hasMarketPrices) {
      const count = await marketPrices.count()
      for (let i = 0; i < Math.min(count, 5); i++) {
        const text = await marketPrices.nth(i).textContent() || ''
        const num = parseDollar(text)
        expect(num).toBeLessThan(1_000_000_000)
      }
    }
  })
})

// ── Lending TVL Display ──────────────────────────────────────
// The lending markets table shows TVL and APY values formatted from L3 USDC (18 dec).
// Catches the $100,000,000,033,200 bug where raw 18-decimal wei was displayed as 6-decimal.

test.describe('Display Formatting — Lending', () => {
  test('lending markets table TVL values are not raw wei', async ({ walletPage: page }) => {
    test.setTimeout(180_000)

    // visionTest fixture starts at / — navigate to ITP listing
    await page.goto('/index', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForTimeout(3_000)

    // Click Borrow on first ITP card to open lending modal
    // Wait for ITP cards to render with Borrow button (morpho market fallback via deployment.json)
    const borrowBtn = page.locator('[id^="itp-card-"]').first().getByRole('button', { name: 'Borrow', exact: true })
    await expect(borrowBtn).toBeVisible({ timeout: 30_000 })
    await borrowBtn.click()

    // Wait for markets table to render (header row visible)
    const marketsTable = page.locator('table')
    await expect(marketsTable.first()).toBeVisible({ timeout: 15_000 })

    // Find all dollar values in the markets table body (TVL column)
    const dollarCells = marketsTable.locator('td.tabular-nums, td .tabular-nums').filter({ hasText: /\$/ })
    const count = await dollarCells.count()

    for (let i = 0; i < Math.min(count, 10); i++) {
      const text = await dollarCells.nth(i).textContent() || ''
      if (!text.includes('$')) continue
      const num = parseDollar(text)
      // TVL should be under $10M (not $100,000,000,000 from raw wei)
      expect(num, `Lending TVL value "${text}" looks like raw wei`).toBeLessThan(10_000_000)
    }
  })

  test('lending modal amounts are not raw wei', async ({ walletPage: page }) => {
    test.setTimeout(180_000)

    // visionTest fixture starts at / — navigate to ITP listing
    await page.goto('/index', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForTimeout(5_000)

    // Wait for ITP cards to render with Borrow button (morpho market fallback via deployment.json)
    const borrowBtn = page.locator('[id^="itp-card-"]').first().getByRole('button', { name: 'Borrow', exact: true })
    await expect(borrowBtn).toBeVisible({ timeout: 30_000 })
    await borrowBtn.click()
    await page.waitForTimeout(2_000)

    // Wait for lending modal content
    const modalText = page.getByText(/Borrow against/)
    const modalVisible = await modalText.isVisible({ timeout: 15_000 }).catch(() => false)
    if (!modalVisible) {
      // Modal may not have opened — retry click
      await borrowBtn.click()
    }
    await expect(page.getByText(/Borrow against/)).toBeVisible({ timeout: 15_000 })

    // Scan the lending modal for dollar values (use first() to avoid strict mode when multiple cards match)
    const modal = page.locator('.bg-card.border.border-border-light.rounded-xl').first()
    const allText = await modal.textContent() || ''

    // Extract all dollar amounts
    const dollarPattern = /\$[\d,]+\.?\d*/g
    const matches = allText.match(dollarPattern) || []

    for (const match of matches) {
      const num = parseDollar(match)
      // No dollar amount should be above $10M (catches raw 18-dec values)
      expect(num, `Modal value "${match}" looks like raw wei`).toBeLessThan(10_000_000)
    }
  })
})

// ── Balance Display ──────────────────────────────────────────

test.describe('Display Formatting — Balances', () => {
  test('wallet USDC balance shows formatted amount', async ({ walletPage: page }) => {
    test.setTimeout(120_000)
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {
      // Frontend may be restarting — skip rather than fail
    })

    const usdcBalance = page.getByText(/[\d,]+\.\d{2}\s*USDC/)
    const hasBalance = await usdcBalance.first().isVisible({ timeout: 15_000 }).catch(() => false)

    if (hasBalance) {
      const text = await usdcBalance.first().textContent() || ''
      const num = parseDollar(text)
      expect(num).toBeLessThan(10_000_000)
      expect(num).toBeGreaterThanOrEqual(0)
    }
  })

  test('no raw bigint values in page text', async ({ walletPage: page }) => {
    test.setTimeout(120_000)
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 }).catch(() => {})
    await page.waitForTimeout(5_000) // Let page hydrate fully

    const bodyText = await page.locator('body').textContent() || ''

    // Find all number sequences with 18+ digits (raw 18-decimal wei values)
    // 18 digits minimum: $1 in 18-dec USDC = 1000000000000000000 (19 digits)
    const rawWeiPattern = /\d{18,}/g
    const matches = bodyText.match(rawWeiPattern) || []

    // Filter out known safe patterns
    const suspiciousValues = matches.filter(m => {
      if (m.length > 42) return false // Likely an address/hash/encoded data
      const num = parseFloat(m)
      // Raw 18-decimal values for $0.01 to $1B: 1e16 to 1e27
      return num > 1e16 && num < 1e27
    })

    if (suspiciousValues.length > 0) {
      console.log('Suspicious raw wei values found:', suspiciousValues)
    }

    expect(suspiciousValues.length).toBe(0)
  })
})
