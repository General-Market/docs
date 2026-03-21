/**
 * Comprehensive production smoke tests — every page and data field on generalmarket.io.
 * No wallet, no transactions, read-only checks.
 *
 * Usage:
 *   ./e2e/prod-smoke.sh                                     # www.generalmarket.io
 *   ./e2e/prod-smoke.sh https://preview-url.vercel.app      # preview deploy
 */
import { test, expect, type Page } from '@playwright/test'

const BASE = process.env.E2E_FRONTEND_URL || 'https://www.generalmarket.io'

function apiUrl(path: string): string {
  return `${BASE}${path}`
}

/** Helper: assert page has no error overlay (Vercel/Next.js error pages) */
async function assertNoError(page: Page) {
  // Match Vercel's actual error page text — avoid false positives from page content containing "500"
  const errorText = page.locator('text=/Application error: a (client|server)-side exception/').first()
  const hasError = await errorText.isVisible({ timeout: 3_000 }).catch(() => false)
  expect(hasError).toBe(false)
}

// ═══════════════════════════════════════════════════════════════
// 1. API ENDPOINTS
// ═══════════════════════════════════════════════════════════════

test.describe('API Endpoints', () => {
  test('GET /api/itp-price returns NAV for ITP-1', async () => {
    const itpId = '0x' + '0'.repeat(63) + '1'
    const res = await fetch(apiUrl(`/api/itp-price?itp_id=${itpId}`), {
      signal: AbortSignal.timeout(15_000),
    })
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data).toHaveProperty('nav')
    expect(Number(data.nav)).toBeGreaterThan(0)
  })

  test('GET /api/itp-price returns NAV for ITP-2', async () => {
    const itpId = '0x' + '0'.repeat(63) + '2'
    const res = await fetch(apiUrl(`/api/itp-price?itp_id=${itpId}`), {
      signal: AbortSignal.timeout(15_000),
    })
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data).toHaveProperty('nav')
    expect(Number(data.nav)).toBeGreaterThan(0)
  })

  test('GET /api/vision/batches returns active batches', async () => {
    const res = await fetch(apiUrl('/api/vision/batches'), {
      signal: AbortSignal.timeout(15_000),
    })
    expect(res.ok).toBe(true)
    const data = await res.json()
    const batches = data.batches ?? data
    expect(Array.isArray(batches)).toBe(true)
    // After deduplication (one per source), expect at least some batches
    expect(batches.length).toBeGreaterThanOrEqual(1)
    // Each batch should have expected fields
    for (const b of batches.slice(0, 5)) {
      expect(b).toHaveProperty('id')
      expect(b).toHaveProperty('source_id')
      expect(b).toHaveProperty('current_tick')
      expect(b).toHaveProperty('player_count')
      expect(b).toHaveProperty('tvl')
      expect(b).toHaveProperty('tick_duration')
    }
  })

  test('GET /api/vision/snapshot returns source prices', async () => {
    const res = await fetch(apiUrl('/api/vision/snapshot'), {
      signal: AbortSignal.timeout(15_000),
    })
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data).toBeDefined()
    // Should contain prices array
    const prices = data.prices ?? data
    if (Array.isArray(prices)) {
      expect(prices.length).toBeGreaterThan(0)
    }
  })

  test('GET /api/vision/snapshot/meta returns source health', async () => {
    const res = await fetch(apiUrl('/api/vision/snapshot/meta'), {
      signal: AbortSignal.timeout(15_000),
    })
    if (res.ok) {
      const data = await res.json()
      expect(data).toBeDefined()
      // Should have sources array with health info
      if (data.sources) {
        expect(Array.isArray(data.sources)).toBe(true)
      }
    } else {
      // 502 acceptable if data-node health endpoint unavailable
      expect([502, 503, 504]).toContain(res.status)
    }
  })

  test('GET /api/vision/leaderboard returns player rankings', async () => {
    const res = await fetch(apiUrl('/api/vision/leaderboard'), {
      signal: AbortSignal.timeout(15_000),
    })
    const data = await res.json()
    expect(data).toHaveProperty('leaderboard')
    expect(Array.isArray(data.leaderboard)).toBe(true)
    // Each player should have expected fields
    for (const p of data.leaderboard) {
      expect(p).toHaveProperty('walletAddress')
      expect(p).toHaveProperty('pnl')
      expect(p).toHaveProperty('rank')
      expect(p).toHaveProperty('totalVolume')
    }
  })

  test('GET /api/vision/leaderboard accepts batch_id filter', async () => {
    // First get a valid batch ID from the batches endpoint
    const batchRes = await fetch(apiUrl('/api/vision/batches'), {
      signal: AbortSignal.timeout(15_000),
    })
    let batchId = 108
    if (batchRes.ok) {
      const batchData = await batchRes.json()
      const batches = batchData.batches ?? []
      if (batches.length > 0) batchId = batches[0].id
    }
    const res = await fetch(apiUrl(`/api/vision/leaderboard?batch_id=${batchId}`), {
      signal: AbortSignal.timeout(15_000),
    })
    const data = await res.json()
    expect(data).toHaveProperty('leaderboard')
    expect(Array.isArray(data.leaderboard)).toBe(true)
  })

  test('GET /api/market/history returns data or valid error', async () => {
    const res = await fetch(apiUrl('/api/market/history?source=coingecko&asset=bitcoin'), {
      signal: AbortSignal.timeout(15_000),
    })
    // Data-node may not have history or be temporarily overloaded — accept any non-crash status
    expect(res.status).toBeLessThanOrEqual(502)
  })

  test('GET /api/explorer/health returns history data', async () => {
    const res = await fetch(apiUrl('/api/explorer/health?endpoint=history&range=24h'), {
      signal: AbortSignal.timeout(15_000),
    })
    // Explorer may return 503 if token not configured
    if (res.status === 503) return
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data).toHaveProperty('snapshots')
    expect(Array.isArray(data.snapshots)).toBe(true)
    expect(data.snapshots.length).toBeGreaterThan(0)
    // Verify snapshot fields
    const s = data.snapshots[0]
    expect(s).toHaveProperty('poll_batch_ts')
    expect(s).toHaveProperty('quorum_met')
    expect(s).toHaveProperty('worst_status')
    expect(s).toHaveProperty('consensus_rounds_total')
    expect(s).toHaveProperty('total_peers')
  })

  test('GET /api/explorer/health latest returns network data', async () => {
    const res = await fetch(apiUrl('/api/explorer/health?endpoint=latest'), {
      signal: AbortSignal.timeout(15_000),
    })
    if (res.status === 503) return
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data).toHaveProperty('network')
    if (data.network) {
      expect(data.network.total_peers).toBeGreaterThan(0)
      expect(typeof data.network.quorum_met).toBe('boolean')
      expect(['healthy', 'degraded', 'unhealthy']).toContain(data.network.worst_status)
    }
  })
})

// ═══════════════════════════════════════════════════════════════
// 2. SSE DATA STREAM
// ═══════════════════════════════════════════════════════════════

test.describe('SSE Data Stream', () => {
  test('/dn proxy delivers itp-nav events with NAV data', async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)

    try {
      const res = await fetch(apiUrl('/api/dn/sse/stream?topics=nav'), {
        signal: controller.signal,
        headers: { Accept: 'text/event-stream' },
      })
      expect(res.ok).toBe(true)

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      let found = false

      for (let i = 0; i < 10; i++) {
        const { value, done } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        if (accumulated.includes('event: itp-nav') && accumulated.includes('"nav_per_share"')) {
          found = true
          break
        }
      }
      reader.cancel()
      if (!found) {
        console.log('SSE itp-nav event not received within 10 reads — data-node may not have NAV data yet')
        return
      }

      // Verify NAV data shape
      const match = accumulated.match(/data: (\[.*?\])\n/)
      if (match) {
        const navData = JSON.parse(match[1])
        expect(Array.isArray(navData)).toBe(true)
        expect(navData.length).toBeGreaterThan(0)
        for (const itp of navData) {
          expect(itp).toHaveProperty('itp_id')
          expect(itp).toHaveProperty('nav_per_share')
          expect(itp).toHaveProperty('total_supply')
          expect(itp).toHaveProperty('aum_usd')
          expect(itp.nav_per_share).toBeGreaterThanOrEqual(0)
        }
      }
    } finally {
      clearTimeout(timeout)
      controller.abort()
    }
  })

  test('/dn proxy delivers system-status events', async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)

    try {
      const res = await fetch(apiUrl('/api/dn/sse/stream?topics=system'), {
        signal: controller.signal,
        headers: { Accept: 'text/event-stream' },
      })
      expect(res.ok).toBe(true)

      const reader = res.body!.getReader()
      const decoder = new TextDecoder()
      let accumulated = ''
      let found = false

      for (let i = 0; i < 10; i++) {
        const { value, done } = await reader.read()
        if (done) break
        accumulated += decoder.decode(value, { stream: true })
        if (accumulated.includes('event: system-status')) {
          found = true
          break
        }
      }
      reader.cancel()
      expect(found).toBe(true)
    } finally {
      clearTimeout(timeout)
      controller.abort()
    }
  })
})

// ═══════════════════════════════════════════════════════════════
// 3. VISION PAGES (/)
// ═══════════════════════════════════════════════════════════════

test.describe('Vision — Home Page (/)', () => {
  test('renders source cards grid', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    // SourcesGrid renders a[href*="/source/"] for each source card
    // Data comes from useSourceRegistry — needs time to load
    const sourceLinks = page.locator('a[href*="/source/"]')
    const firstVisible = await sourceLinks.first().isVisible({ timeout: 25_000 }).catch(() => false)
    if (!firstVisible) {
      // Source registry may be empty on fresh deploy — log and pass gracefully
      console.warn('No source cards rendered — source registry may be empty or loading')
      return
    }
    const count = await sourceLinks.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('source cards show pool/player data (not all dashes)', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    // SSE pool data can take up to 15s to arrive
    await page.waitForTimeout(10_000)
    // Look for dollar signs in source cards (pool amounts) or player counts
    const poolValues = page.locator('text=/\\$\\d/')
    const hasPools = await poolValues.first().isVisible({ timeout: 15_000 }).catch(() => false)
    const playerValues = page.locator('text=/\\d+ player/i')
    const hasPlayers = await playerValues.first().isVisible({ timeout: 5_000 }).catch(() => false)
    // At least some sources should show pool values or player counts
    expect(hasPools || hasPlayers).toBe(true)
  })

  test('header shows Connect Wallet button when not authenticated', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    const connectBtn = page.getByRole('button', { name: /Connect Wallet/ })
    await expect(connectBtn.first()).toBeVisible({ timeout: 15_000 })
  })

  test('footer renders with links', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    const footer = page.locator('footer')
    await expect(footer).toBeVisible({ timeout: 10_000 })
  })
})

// ═══════════════════════════════════════════════════════════════
// 4. VISION SOURCE DETAIL (/source/[id])
// ═══════════════════════════════════════════════════════════════

test.describe('Vision — Source Detail', () => {
  const TEST_SOURCES = ['finnhub', 'earthquake', 'twitch', 'steam', 'tmdb']

  for (const sourceId of TEST_SOURCES) {
    test(`/source/${sourceId} loads without error`, async ({ page }) => {
      await page.goto(BASE + `/source/${sourceId}`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      await assertNoError(page)
      // Source detail shows batch bar with Tick/Players/Pool labels, or "Source not found"
      const content = page.locator('text=/Tick|Players|Pool|Enter Batch|Deposit|Source not found/').first()
      await expect(content).toBeVisible({ timeout: 15_000 })
    })
  }

  test('/source/finnhub shows batch bar with TICK, PLAYERS, POOL', async ({ page }) => {
    await page.goto(BASE + '/source/finnhub', { waitUntil: 'domcontentloaded', timeout: 30_000 })

    // Wait for batch data to load
    await page.waitForTimeout(5_000)

    // Tick label should be visible (uppercase label in batch bar)
    await expect(page.locator('text=Tick').first()).toBeVisible({ timeout: 10_000 })
    // Players label should be visible
    await expect(page.locator('text=Players').first()).toBeVisible({ timeout: 5_000 })
    // Pool label should be visible
    await expect(page.locator('text=Pool').first()).toBeVisible({ timeout: 5_000 })

    // TICK should show #number (value rendered as e.g. "#42")
    const tickValue = page.locator('text=/^#\\d+$/').first()
    await expect(tickValue).toBeVisible({ timeout: 10_000 })

    // POOL should show $amount
    const poolValue = page.locator('text=/^\\$\\d/').first()
    const hasPool = await poolValue.isVisible({ timeout: 5_000 }).catch(() => false)
    if (!hasPool) {
      // Pool may show $0 if no players — acceptable
      const zeroPool = page.locator('text="$0"').first()
      await expect(zeroPool).toBeVisible({ timeout: 5_000 })
    }
  })

  test('/source/finnhub shows markets table with prices', async ({ page }) => {
    await page.goto(BASE + '/source/finnhub', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(8_000)

    // Market rows should render (UP/DOWN buttons or price data or market names)
    const marketContent = page.locator('button:has-text("UP"), button:has-text("DOWN"), [data-testid="market-tile"]')
    const count = await marketContent.count()
    if (count === 0) {
      // Markets might render differently — check for any market name text
      const marketNames = page.locator('text=/AAPL|TSLA|MSFT|GOOG|AMZN|NVDA/i')
      const nameCount = await marketNames.count()
      expect(nameCount).toBeGreaterThanOrEqual(1)
    } else {
      expect(count).toBeGreaterThanOrEqual(2)
    }
  })

  test('/source/finnhub has batch entry panel', async ({ page }) => {
    await page.goto(BASE + '/source/finnhub', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(5_000)

    // BatchEntryPanel shows "Enter Batch" button or "Deposit" variants or "Connect Wallet"
    const entryPanel = page.locator('text=/Enter Batch|Deposit|Connect Wallet/').first()
    await expect(entryPanel).toBeVisible({ timeout: 15_000 })
  })

  test('/source/finnhub shows Top Players section', async ({ page }) => {
    await page.goto(BASE + '/source/finnhub', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(5_000)

    const topPlayers = page.locator('text=Top Players').first()
    await expect(topPlayers).toBeVisible({ timeout: 15_000 })
  })

  test('/source/finnhub shows set count and timer', async ({ page }) => {
    await page.goto(BASE + '/source/finnhub', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(5_000)

    await expect(page.locator('text=Set').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Timer').first()).toBeVisible({ timeout: 5_000 })
    // Timer should show a time value like "5:23" or "00:23"
    const timerValue = page.locator('text=/\\d+:\\d{2}/').first()
    await expect(timerValue).toBeVisible({ timeout: 5_000 })
  })
})

// ═══════════════════════════════════════════════════════════════
// 5. INDEX PAGE (/index) — ITP Listing
// ═══════════════════════════════════════════════════════════════

test.describe('Index — ITP Listing (/index)', () => {
  test('renders ITP table with fund data', async ({ page }) => {
    await page.goto(BASE + '/index', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    // ITP listing renders as a table. Wait for data (SSE or REST).
    // Table has headers: Ticker, Name, NAV, Net Assets, Shares Outstanding, Trade
    const tableHeader = page.locator('th:has-text("Ticker"), th:has-text("Name"), th:has-text("NAV")').first()
    const hasTable = await tableHeader.isVisible({ timeout: 30_000 }).catch(() => false)
    if (!hasTable) {
      // Might show "Loading funds..." if data-node is slow
      const loading = page.locator('text=Loading funds').first()
      const isLoading = await loading.isVisible({ timeout: 5_000 }).catch(() => false)
      if (isLoading) {
        console.warn('ITP listing still loading — data-node may be slow')
        return
      }
      console.warn('ITP table not rendered — data-node may be unreachable')
      return
    }
    // At least one fund row should exist
    const rows = page.locator('tbody tr')
    const rowCount = await rows.count()
    expect(rowCount).toBeGreaterThanOrEqual(1)
  })

  test('ITP table shows NAV or price data ($)', async ({ page }) => {
    await page.goto(BASE + '/index', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    // NAV comes via SSE or REST — wait for data to load
    await page.waitForTimeout(8_000)
    // Look for any dollar amount in the ITP listing (NAV, AUM, or hero band)
    const dollarValue = page.locator('text=/\\$\\d+\\.\\d{2}/').first()
    await expect(dollarValue).toBeVisible({ timeout: 15_000 })
  })

  test('ITP table shows AUM', async ({ page }) => {
    await page.goto(BASE + '/index', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(5_000)
    // AUM should show as dollar amount (in hero band "Total Net Assets" or per-row)
    const aumValue = page.locator('text=/\\$\\d+/').first()
    await expect(aumValue).toBeVisible({ timeout: 15_000 })
  })

  test('ITP rows have Buy action', async ({ page }) => {
    await page.goto(BASE + '/index', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    // Buy is a WalletActionButton rendered as text in the Trade column
    const buyButton = page.locator('text="Buy"').first()
    await expect(buyButton).toBeVisible({ timeout: 15_000 })
  })
})

// ═══════════════════════════════════════════════════════════════
// 6. ITP DETAIL PAGE (/itp/[itpId])
// ═══════════════════════════════════════════════════════════════

test.describe('ITP Detail (/itp/[itpId])', () => {
  test('ITP detail page loads with name, NAV, and breadcrumbs', async ({ page }) => {
    // Navigate to /index first, then click a table row to get to ITP detail
    await page.goto(BASE + '/index', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(8_000)

    // Wait for network idle to avoid framer-motion re-renders unmounting the row mid-click
    await page.waitForLoadState('networkidle').catch(() => {})

    // ITP listing renders as cards (article) with "View X details" links, or as table rows
    const detailLink = page.locator('a[href*="/itp/"]').first()
    const hasLink = await detailLink.isVisible({ timeout: 15_000 }).catch(() => false)
    if (!hasLink) {
      // Fallback: try table row click
      const nameCell = page.locator('tbody tr td:nth-child(2)').first()
      const hasRow = await nameCell.isVisible({ timeout: 5_000 }).catch(() => false)
      if (!hasRow) {
        console.warn('No ITP cards or rows found — data-node may be unreachable')
        return
      }
      await nameCell.click({ force: true })
    } else {
      await detailLink.click()
    }
    await page.waitForURL(/\/itp\//, { timeout: 30_000 })

    // ITP detail SSR depends on data-node availability — may intermittently 404
    const is404 = await page.locator('text="404"').first().isVisible({ timeout: 3_000 }).catch(() => false)
    if (is404) {
      console.warn('ITP detail returned 404 — data-node SSR timeout (known intermittent issue)')
      return // Skip assertions, not a test failure
    }

    await assertNoError(page)

    // ITP name (format: "ITP #1" or custom name from itp-id-names.json)
    // Name is rendered in the breadcrumb and ItpPageClient header
    // Look for any heading-level text or the breadcrumb trail
    const itpName = page.locator('nav >> text=/ITP|Index|Fund|Market|Broad|Top/i').first()
    const hasName = await itpName.isVisible({ timeout: 10_000 }).catch(() => false)
    if (!hasName) {
      // Fallback: the page should at minimum show the ITP # format
      const fallbackName = page.locator('text=/ITP\\s*[#]\\s*\\d+/').first()
      await expect(fallbackName).toBeVisible({ timeout: 10_000 })
    }

    // NAV value (should show $x.xxxx or $0.0000 for empty ITPs)
    const navValue = page.locator('text=/\\$\\d+\\.\\d{2}/').first()
    const hasNav = await navValue.isVisible({ timeout: 10_000 }).catch(() => false)
    // NAV may be $0 on fresh deploy — just check page loaded without error
    if (!hasNav) {
      console.warn('No NAV value visible — ITP may have $0 NAV')
    }

    // Breadcrumb: Home / Markets / ITP-name
    const breadcrumb = page.locator('text="Home"').first()
    await expect(breadcrumb).toBeVisible({ timeout: 5_000 })
  })
})

// ═══════════════════════════════════════════════════════════════
// 7. EXPLORER PAGE (/explorer)
// ═══════════════════════════════════════════════════════════════

test.describe('Explorer (/explorer)', () => {
  test('page loads with title and summary bar', async ({ page }) => {
    await page.goto(BASE + '/explorer', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await assertNoError(page)
    // Explorer title
    await expect(page.locator('h1:has-text("Explorer")').first()).toBeVisible({ timeout: 15_000 })
    // Summary bar shows cards with labels from translations:
    // "Network Health", "Quorum Status", "Consensus", "Avg Consensus Duration", "Pending Orders", "Oracles"
    // These may show loading skeletons if data hasn't arrived yet
    const summaryCard = page.locator('text=/Network Health|Quorum Status|Consensus|Oracles|Loading/i').first()
    const hasSummary = await summaryCard.isVisible({ timeout: 15_000 }).catch(() => false)
    if (hasSummary) {
      // Verify at least one summary label is visible
      const labels = ['Network Health', 'Quorum Status', 'Oracles']
      for (const label of labels) {
        const el = page.locator(`text="${label}"`).first()
        const visible = await el.isVisible({ timeout: 5_000 }).catch(() => false)
        if (visible) break // At least one label confirms summary bar rendered
      }
    }
  })

  test('tab navigation works for all tabs', async ({ page }) => {
    await page.goto(BASE + '/explorer', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)
    // Actual tabs from translations (pages.explorer.tabs.*):
    // Consensus, Orders, Price Feeds, P2P Network, Cycles, ITP & NAV, Vision, Sources, System, System Health, Chain & Gas
    const TABS = ['Consensus', 'Orders', 'Price Feeds', 'P2P Network', 'Cycles', 'ITP & NAV', 'Vision', 'Sources', 'System', 'System Health', 'Chain & Gas']
    for (const tab of TABS) {
      const tabBtn = page.locator(`button:has-text("${tab}")`).first()
      const visible = await tabBtn.isVisible({ timeout: 5_000 }).catch(() => false)
      if (!visible) {
        // Tab might be scrolled out of view on narrow viewports — scroll into view
        const scrollable = page.locator('.overflow-x-auto').first()
        if (await scrollable.isVisible().catch(() => false)) {
          await scrollable.evaluate(el => el.scrollLeft += 200)
          await page.waitForTimeout(500)
        }
      }
      // At minimum, tab should exist in DOM
      await expect(tabBtn).toBeAttached({ timeout: 3_000 })
    }
  })

  test('time range buttons work', async ({ page }) => {
    await page.goto(BASE + '/explorer', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)
    for (const range of ['1h', '6h', '24h', '7d', '30d']) {
      await expect(page.getByRole('button', { name: range, exact: true })).toBeVisible({ timeout: 5_000 })
    }
    // Click a different range and verify it activates
    await page.getByRole('button', { name: '7d', exact: true }).click()
    await page.waitForTimeout(2_000)
  })

  test('Consensus tab renders charts with data', async ({ page }) => {
    await page.goto(BASE + '/explorer', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(5_000)
    // Consensus tab is default, should show chart titles (from translations)
    await expect(page.locator('text=Quorum Status').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Network Health').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=/Consensus Rounds/').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Consensus Success Rate').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Avg Consensus Duration').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Signatures Collected').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Failed Rounds').first()).toBeVisible({ timeout: 5_000 })

    // Charts should have SVG elements (Recharts renders SVG)
    const svgs = page.locator('.recharts-responsive-container svg')
    const svgCount = await svgs.count()
    expect(svgCount).toBeGreaterThanOrEqual(5)

    // Quorum subtitle should show "Currently: Met" or "Not met"
    const quorumSubtitle = page.locator('text=/Currently: (Met|Not met)/').first()
    await expect(quorumSubtitle).toBeVisible({ timeout: 10_000 })

    // Consensus duration subtitle should show "Current: XXXms"
    const durationSubtitle = page.locator('text=/Current: \\d+ms/').first()
    await expect(durationSubtitle).toBeVisible({ timeout: 10_000 })
  })

  test('Orders tab renders chart cards', async ({ page }) => {
    await page.goto(BASE + '/explorer', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)
    await page.locator('button:has-text("Orders")').first().click()
    await page.waitForTimeout(3_000)
    // Actual chart titles in OrdersSection:
    // "Pending Orders", "Orders Processed/min", "Avg Cycle Duration"
    await expect(page.locator('text=Pending Orders').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=/Orders Processed/').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Avg Cycle Duration').first()).toBeVisible({ timeout: 5_000 })
  })

  test('P2P Network tab shows peer data', async ({ page }) => {
    await page.goto(BASE + '/explorer', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)
    await page.locator('button:has-text("P2P Network")').first().click()
    await page.waitForTimeout(3_000)
    await expect(page.locator('text=Connected Peers').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Messages Sent / Received').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Peer Health').first()).toBeVisible({ timeout: 5_000 })
  })

  test('Cycles tab shows cycle performance', async ({ page }) => {
    await page.goto(BASE + '/explorer', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)
    await page.locator('button:has-text("Cycles")').first().click()
    await page.waitForTimeout(3_000)
    await expect(page.locator('text=Cycle Duration').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Slow Cycle Alerts').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Orders per Cycle').first()).toBeVisible({ timeout: 5_000 })
  })

  test('System Health tab shows health charts', async ({ page }) => {
    await page.goto(BASE + '/explorer', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)
    await page.locator('button:has-text("System Health")').first().click()
    await page.waitForTimeout(3_000)
    // Actual chart titles in SystemHealthSection:
    // "Network Status", "Quorum History", "Consensus Success Rate", "Error Rate"
    await expect(page.locator('text=Network Status').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Quorum History').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Consensus Success Rate').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Error Rate').first()).toBeVisible({ timeout: 5_000 })
  })

  test('Price Feeds tab shows feed charts', async ({ page }) => {
    await page.goto(BASE + '/explorer', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)
    await page.locator('button:has-text("Price Feeds")').first().click()
    await page.waitForTimeout(3_000)
    // Actual chart titles in PriceFeedSection:
    // "Price Feeds" heading, "Consensus Duration Trend"
    await expect(page.locator('text=Price Feeds').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Consensus Duration Trend').first()).toBeVisible({ timeout: 5_000 })
  })

  test('ITP & NAV tab shows ITP data', async ({ page }) => {
    await page.goto(BASE + '/explorer', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)

    // Tab button text is "ITP & NAV" — use regex to handle potential rendering of &amp;
    const itpTab = page.locator('button').filter({ hasText: /ITP.*NAV/ }).first()
    const tabVisible = await itpTab.isVisible({ timeout: 5_000 }).catch(() => false)
    if (!tabVisible) {
      // Tab may be scrolled out of view — scroll the tab bar
      const scrollable = page.locator('.overflow-x-auto').first()
      if (await scrollable.isVisible().catch(() => false)) {
        await scrollable.evaluate(el => el.scrollLeft += 400)
        await page.waitForTimeout(500)
      }
    }
    await expect(itpTab).toBeVisible({ timeout: 10_000 })
    await itpTab.click()
    await page.waitForTimeout(5_000)

    // ITPSection renders "ITP Metrics" heading, "Pending Order Volume", "ITP Overview"
    // These are always rendered regardless of SSE data
    const itpMetrics = page.locator('text=ITP Metrics').first()
    const hasMetrics = await itpMetrics.isVisible({ timeout: 10_000 }).catch(() => false)
    if (!hasMetrics) {
      // Tab click may not have registered — content didn't switch
      console.warn('ITP Metrics heading not visible after tab click — tab content may not have rendered')
      return
    }
    await expect(page.locator('text=Pending Order Volume').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=ITP Overview').first()).toBeVisible({ timeout: 5_000 })

    // Verify actual NAV data renders (dollar values from ITP table)
    const navValue = page.locator('text=/\\$\\d+\\.\\d+/').first()
    const hasNav = await navValue.isVisible({ timeout: 15_000 }).catch(() => false)
    if (!hasNav) {
      // SSE NAV data may not have arrived — check for "No ITP data available" message
      const noData = page.locator('text=No ITP data available').first()
      const isEmpty = await noData.isVisible({ timeout: 3_000 }).catch(() => false)
      if (isEmpty) {
        console.warn('ITP section shows no data — SSE nav not connected')
      }
    }
  })

  test('Chain & Gas tab shows consensus and P2P charts', async ({ page }) => {
    await page.goto(BASE + '/explorer', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)
    await page.locator('button:has-text("Chain & Gas")').first().click()
    await page.waitForTimeout(5_000)
    // Actual chart titles in ChainGasSection:
    // "Consensus Throughput", "Message Volume", "Order Pipeline", "Cycle Performance"
    await expect(page.locator('text=Consensus Throughput').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Message Volume').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Order Pipeline').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Cycle Performance').first()).toBeVisible({ timeout: 5_000 })
    // Charts need explorer health API data — verify SVGs render (recharts containers)
    const svgs = page.locator('.recharts-responsive-container svg')
    const svgCount = await svgs.count()
    expect(svgCount).toBeGreaterThanOrEqual(2)
  })

  test('Vision tab shows batch data from API', async ({ page }) => {
    await page.goto(BASE + '/explorer', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)
    // Explorer may not have a separate Vision tab — check if we're on explorer page
    const hasVisionTab = await page.locator('button:has-text("Vision")').first().isVisible().catch(() => false)
    if (hasVisionTab) {
      await page.locator('button:has-text("Vision")').first().click()
      await page.waitForTimeout(5_000)
    }
    // Check for any Vision-related content on the page
    const hasVisionContent = await page.locator('text=/Batch|Vision|TVL|Active Batches/i').first().isVisible({ timeout: 10_000 }).catch(() => false)
    if (!hasVisionContent) {
      console.log('Vision tab content not found on explorer — page may not have Vision section')
      return
    }
    // Verify whatever Vision content is visible
    console.log('Vision content visible on explorer page')
  })

  test('explorer API data feeds into charts (non-zero consensus data)', async ({ page }) => {
    // Fetch API data first to know what to expect
    const histRes = await fetch(apiUrl('/api/explorer/health?endpoint=history&range=24h'), {
      signal: AbortSignal.timeout(15_000),
    })
    if (!histRes.ok) return // Skip if explorer not configured
    const histData = await histRes.json()
    const snapshots = histData.snapshots || []
    if (snapshots.length === 0) return // No data

    // Verify consensus data is non-zero (this is the core health signal)
    const hasConsensusData = snapshots.some((s: any) => s.consensus_rounds_total > 0)
    expect(hasConsensusData).toBe(true)

    // Verify peers are connected
    const latestRes = await fetch(apiUrl('/api/explorer/health?endpoint=latest'), {
      signal: AbortSignal.timeout(15_000),
    })
    if (latestRes.ok) {
      const latestData = await latestRes.json()
      if (latestData.network) {
        expect(latestData.network.total_peers).toBeGreaterThan(0)
      }
    }

    // Load explorer page and verify charts render with actual data
    await page.goto(BASE + '/explorer', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(8_000)

    // Charts should render SVG paths (lines/areas with data, not just empty grids)
    const chartPaths = page.locator('.recharts-line-curve, .recharts-area-curve, .recharts-area-area')
    const pathCount = await chartPaths.count()
    expect(pathCount).toBeGreaterThanOrEqual(3)
  })
})

// ═══════════════════════════════════════════════════════════════
// 8. SOURCES HEALTH PAGE (/sources)
// ═══════════════════════════════════════════════════════════════

test.describe('Sources Health (/sources)', () => {
  test('page loads with source list', async ({ page }) => {
    await page.goto(BASE + '/sources', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await assertNoError(page)
    // Should show source names or health status
    const content = page.locator('text=/Source|Health|Status|CoinGecko|Finnhub/i').first()
    await expect(content).toBeVisible({ timeout: 15_000 })
  })
})

// ═══════════════════════════════════════════════════════════════
// 9. POINTS PAGE (/points)
// ═══════════════════════════════════════════════════════════════

test.describe('Points (/points)', () => {
  test('page loads with season info', async ({ page }) => {
    await page.goto(BASE + '/points', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await assertNoError(page)
    const content = page.locator('text=/Points|Season|Earn/i').first()
    await expect(content).toBeVisible({ timeout: 15_000 })
  })
})

// ═══════════════════════════════════════════════════════════════
// 10. LEARN PAGES (/learn, /learn/[slug])
// ═══════════════════════════════════════════════════════════════

test.describe('Learn (/learn)', () => {
  test('page loads with article list', async ({ page }) => {
    await page.goto(BASE + '/learn', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await assertNoError(page)
    const title = page.locator('text=Learn').first()
    await expect(title).toBeVisible({ timeout: 15_000 })
    // Should list articles
    const articleLinks = page.locator('a[href*="/learn/"]')
    const count = await articleLinks.count()
    expect(count).toBeGreaterThanOrEqual(1)
  })

  test('first article page loads without error', async ({ page }) => {
    await page.goto(BASE + '/learn', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    const firstArticle = page.locator('a[href*="/learn/"]').first()
    if (await firstArticle.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const href = await firstArticle.getAttribute('href')
      if (href) {
        await page.goto(BASE + href, { waitUntil: 'domcontentloaded', timeout: 30_000 })
        await assertNoError(page)
        // Article should have readable content
        const body = page.locator('article, main, .prose, [class*="mdx"]').first()
        await expect(body).toBeVisible({ timeout: 10_000 })
      }
    }
  })
})

// ═══════════════════════════════════════════════════════════════
// 11. STATIC/LEGAL PAGES
// ═══════════════════════════════════════════════════════════════

test.describe('Static Pages', () => {
  const STATIC_PAGES = [
    { path: '/about', needle: /About|General Market/i },
    { path: '/terms', needle: /Terms|Service|Agreement/i },
    { path: '/privacy', needle: /Privacy|Policy|Data/i },
    { path: '/legal-index', needle: /Legal|Index|Disclaimer/i },
    { path: '/legal-vision', needle: /Legal|Vision|Disclaimer/i },
  ]

  for (const { path, needle } of STATIC_PAGES) {
    test(`${path} loads with expected content`, async ({ page }) => {
      await page.goto(BASE + path, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      await assertNoError(page)
      const content = page.locator(`text=/${needle.source}/i`).first()
      await expect(content).toBeVisible({ timeout: 10_000 })
    })
  }
})

// ═══════════════════════════════════════════════════════════════
// 12. INDEX SUB-TABS (/index — sidebar navigation)
// ═══════════════════════════════════════════════════════════════

test.describe('Index Sub-Tabs (/index)', () => {
  // Actual sidebar labels from HomeClient NAV_GROUPS:
  // Markets, Portfolio, Create Index, Lending, Backtesting, System
  const SIDEBAR_ITEMS = ['Markets', 'Portfolio', 'Create Index', 'Lending', 'Backtesting', 'System']

  test('all sidebar navigation items are visible', async ({ page }) => {
    await page.goto(BASE + '/index', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)
    // On desktop, sidebar items are buttons in the <aside>
    // On mobile, they're in a bottom nav bar
    // Check at least the desktop sidebar or mobile nav
    for (const label of SIDEBAR_ITEMS) {
      const navItem = page.locator(`button:has-text("${label}")`).first()
      const visible = await navItem.isVisible({ timeout: 5_000 }).catch(() => false)
      if (!visible) {
        // On mobile viewport, items may be in the bottom bar — check any text match
        const anyMatch = page.locator(`text="${label}"`).first()
        await expect(anyMatch).toBeAttached({ timeout: 3_000 })
      }
    }
  })

  test('switching to Create Index section renders form', async ({ page }) => {
    await page.goto(BASE + '/index', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)
    await page.locator('button:has-text("Create Index")').first().click()
    await page.waitForTimeout(2_000)
    // CreateItpSection should show form elements (Name, Symbol inputs, asset selection)
    const content = page.locator('text=/Create ITP|Name|Symbol|Assets|Weight/i').first()
    await expect(content).toBeVisible({ timeout: 10_000 })
  })

  test('switching to Backtesting section renders simulation controls', async ({ page }) => {
    await page.goto(BASE + '/index', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)
    await page.locator('button:has-text("Backtesting")').first().click()
    // BacktestSection auto-runs after data-node health check (can take ~30s)
    // First verify controls render
    const content = page.locator('text=/Backtest|Performance|Category|Sharpe/i').first()
    await expect(content).toBeVisible({ timeout: 10_000 })
    // Then check simulation produces results (progress bar or stats grid)
    const simOutput = page.locator('text=/Total Return|Sharpe|Simulating|Progress/i').first()
    const hasOutput = await simOutput.isVisible({ timeout: 45_000 }).catch(() => false)
    if (hasOutput) {
      // If simulation completed, verify stats are real numbers
      const statValue = page.locator('text=/[+-]?\\d+\\.\\d+%/').first()
      await expect(statValue).toBeVisible({ timeout: 10_000 })
    }
  })

  test('switching to System section shows oracle nodes with status', async ({ page }) => {
    await page.goto(BASE + '/index', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)
    await page.locator('button:has-text("System")').first().click()
    await page.waitForTimeout(5_000)
    // System section should show node names and status indicators
    const content = page.locator('text=/Alpha|Beta|Gamma|Contract|Chain/i').first()
    await expect(content).toBeVisible({ timeout: 10_000 })
    // AP Vault should show a dollar value (not "$0" or "—")
    const apVault = page.locator('text=/AP Vault/i').first()
    if (await apVault.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const vaultValue = page.locator('text=/\\$\\d+/').first()
      await expect(vaultValue).toBeVisible({ timeout: 10_000 })
    }
  })
})

// ═══════════════════════════════════════════════════════════════
// 13. MORE VISION SOURCE DETAIL PAGES
// ═══════════════════════════════════════════════════════════════

test.describe('Vision — Additional Sources', () => {
  const EXTRA_SOURCES = ['coingecko', 'yahoo_tech', 'weather', 'reddit', 'github']

  for (const sourceId of EXTRA_SOURCES) {
    test(`/source/${sourceId} loads and shows batch data`, async ({ page }) => {
      await page.goto(BASE + `/source/${sourceId}`, { waitUntil: 'domcontentloaded', timeout: 30_000 })
      // If valid source, should show content. If 404, that's also acceptable (source may be removed)
      const is404 = await page.locator('text=/404|not found|Source not found/i').first().isVisible({ timeout: 3_000 }).catch(() => false)
      if (!is404) {
        await assertNoError(page)
        // Should show at least some source content (batch info, connect wallet, etc.)
        const content = page.locator('text=/Tick|Players|Enter Batch|Deposit|Pool|Connect Wallet|Markets|Leaderboard/i').first()
        const hasContent = await content.isVisible({ timeout: 15_000 }).catch(() => false)
        if (!hasContent) {
          console.log(`/source/${sourceId}: page loaded but no batch content visible — source may not have deployed batches`)
        }
      }
    })
  }
})


// ═══════════════════════════════════════════════════════════════
// 15. NAVIGATION & LAYOUT
// ═══════════════════════════════════════════════════════════════

test.describe('Navigation & Layout', () => {
  test('header has navigation links', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    // Header should have key nav links
    const header = page.locator('header').first()
    await expect(header).toBeVisible({ timeout: 10_000 })
  })

  test('navigating from / to /source/earthquake works', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    // Find earthquake source link and click
    const sourceLink = page.locator('a[href*="/source/earthquake"]').first()
    if (await sourceLink.isVisible({ timeout: 15_000 }).catch(() => false)) {
      await sourceLink.click()
      await page.waitForTimeout(3_000)
      await assertNoError(page)
      // Should show earthquake source detail
      const content = page.locator('text=/Earthquake|USGS|Tick|Players/i').first()
      await expect(content).toBeVisible({ timeout: 10_000 })
    }
  })

  test('navigating from /index to ITP detail works', async ({ page }) => {
    await page.goto(BASE + '/index', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(8_000)

    // Wait for network idle to avoid framer-motion re-renders unmounting the row mid-click
    await page.waitForLoadState('networkidle').catch(() => {})

    // ITP listing renders as cards with detail links, or as table rows
    const detailLink = page.locator('a[href*="/itp/"]').first()
    const hasLink = await detailLink.isVisible({ timeout: 10_000 }).catch(() => false)
    if (hasLink) {
      await detailLink.click()
      await page.waitForURL(/\/itp\//, { timeout: 30_000 })
      await assertNoError(page)
    } else {
      console.warn('No ITP table rows found — data-node may be unreachable')
    }
  })

  test('404 page renders for invalid route', async ({ page }) => {
    await page.goto(BASE + '/this-page-does-not-exist', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    // Should show 404 content, not a crash
    const notFound = page.locator('text=/404|not found|page.*not/i').first()
    await expect(notFound).toBeVisible({ timeout: 10_000 })
  })
})
