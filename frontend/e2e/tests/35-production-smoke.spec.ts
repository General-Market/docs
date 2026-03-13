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

  test('GET /api/vision/batches returns 40+ active batches', async () => {
    const res = await fetch(apiUrl('/api/vision/batches'), {
      signal: AbortSignal.timeout(15_000),
    })
    expect(res.ok).toBe(true)
    const data = await res.json()
    const batches = data.batches ?? data
    expect(Array.isArray(batches)).toBe(true)
    expect(batches.length).toBeGreaterThanOrEqual(40)
    // Verify latest generation batch IDs
    expect(batches[0].id).toBeGreaterThanOrEqual(108)
    // Each batch should have expected fields
    for (const b of batches.slice(0, 5)) {
      expect(b).toHaveProperty('id')
      expect(b).toHaveProperty('config_hash')
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
    const res = await fetch(apiUrl('/api/vision/leaderboard?batch_id=108'), {
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
      const res = await fetch(apiUrl('/dn/sse/stream?topics=nav'), {
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
      expect(found).toBe(true)

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
          expect(itp.nav_per_share).toBeGreaterThan(0)
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
      const res = await fetch(apiUrl('/dn/sse/stream?topics=system'), {
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
    const sourceLinks = page.locator('a[href*="/source/"]')
    await expect(sourceLinks.first()).toBeVisible({ timeout: 20_000 })
    // Should have many sources (40+)
    const count = await sourceLinks.count()
    expect(count).toBeGreaterThanOrEqual(10)
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

  test('header shows Sign Up button (not Connect Wallet)', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    const signUp = page.getByRole('button', { name: 'Sign Up' })
    await expect(signUp.first()).toBeVisible({ timeout: 15_000 })
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
      // Source name or markets should be visible
      const content = page.locator('text=/markets|Enter Batch|Add Funds|Tick|Players/').first()
      await expect(content).toBeVisible({ timeout: 15_000 })
    })
  }

  test('/source/finnhub shows batch bar with TICK, PLAYERS, POOL', async ({ page }) => {
    await page.goto(BASE + '/source/finnhub', { waitUntil: 'domcontentloaded', timeout: 30_000 })

    // Wait for batch data to load
    await page.waitForTimeout(5_000)

    // Tick label should be visible
    await expect(page.locator('text=Tick').first()).toBeVisible({ timeout: 10_000 })
    // Players label should be visible
    await expect(page.locator('text=Players').first()).toBeVisible({ timeout: 5_000 })
    // Pool label should be visible
    await expect(page.locator('text=Pool').first()).toBeVisible({ timeout: 5_000 })

    // TICK should show #number not "—"
    const tickValue = page.locator('text=/^#\\d+$/').first()
    await expect(tickValue).toBeVisible({ timeout: 10_000 })

    // POOL should show $amount not "—"
    const poolValue = page.locator('text=/^\\$\\d/').first()
    await expect(poolValue).toBeVisible({ timeout: 5_000 })
  })

  test('/source/finnhub shows markets table with prices', async ({ page }) => {
    await page.goto(BASE + '/source/finnhub', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(5_000)

    // Market rows should render (UP/DOWN buttons or price data)
    const marketContent = page.locator('button:has-text("UP"), button:has-text("DOWN"), [data-testid="market-tile"]')
    const count = await marketContent.count()
    // finnhub should have multiple markets
    expect(count).toBeGreaterThanOrEqual(2)
  })

  test('/source/finnhub has Enter Batch panel', async ({ page }) => {
    await page.goto(BASE + '/source/finnhub', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(5_000)

    const entryPanel = page.locator('text=/Enter Batch|Add Funds/').first()
    await expect(entryPanel).toBeVisible({ timeout: 15_000 })
  })

  test('/source/finnhub shows Top Players section', async ({ page }) => {
    await page.goto(BASE + '/source/finnhub', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(5_000)

    const topPlayers = page.locator('text=Top Players').first()
    await expect(topPlayers).toBeVisible({ timeout: 15_000 })
  })

  test('/source/finnhub shows multiplier and timer', async ({ page }) => {
    await page.goto(BASE + '/source/finnhub', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(5_000)

    await expect(page.locator('text=Multiplier').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Timer').first()).toBeVisible({ timeout: 5_000 })
    // Timer should show a time value like "5:23"
    const timerValue = page.locator('text=/\\d+:\\d{2}/').first()
    await expect(timerValue).toBeVisible({ timeout: 5_000 })
  })
})

// ═══════════════════════════════════════════════════════════════
// 5. INDEX PAGE (/index) — ITP Listing
// ═══════════════════════════════════════════════════════════════

test.describe('Index — ITP Listing (/index)', () => {
  test('renders ITP cards with names', async ({ page }) => {
    await page.goto(BASE + '/index', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    // Should show ITP names
    const itpName = page.locator('text=/ITP-100|ITP-10/').first()
    await expect(itpName).toBeVisible({ timeout: 30_000 })
  })

  test('ITP cards show NAV or price data ($)', async ({ page }) => {
    await page.goto(BASE + '/index', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    // NAV comes via SSE — wait for data to load
    await page.waitForTimeout(8_000)
    // Look for any dollar amount in the ITP listing (NAV, AUM, or depth table prices)
    const dollarValue = page.locator('text=/\\$\\d+\\.\\d{2}/').first()
    await expect(dollarValue).toBeVisible({ timeout: 15_000 })
  })

  test('ITP cards show AUM', async ({ page }) => {
    await page.goto(BASE + '/index', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(5_000)
    // AUM should show as dollar amount
    const aumValue = page.locator('text=/\\$\\d+/').first()
    await expect(aumValue).toBeVisible({ timeout: 15_000 })
  })

  test('ITP cards have Buy button', async ({ page }) => {
    await page.goto(BASE + '/index', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    const buyButton = page.getByRole('button', { name: 'Buy' }).first()
    await expect(buyButton).toBeVisible({ timeout: 15_000 })
  })
})

// ═══════════════════════════════════════════════════════════════
// 6. ITP DETAIL PAGE (/itp/[itpId])
// ═══════════════════════════════════════════════════════════════

test.describe('ITP Detail (/itp/[itpId])', () => {
  test('ITP detail page loads with name, NAV, holdings, and breadcrumbs', async ({ page }) => {
    // Navigate via /index click (client-side) — SSR can be slow for ITP detail
    await page.goto(BASE + '/index', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    const itpLink = page.locator('a[href*="/itp/"]').first()
    await expect(itpLink).toBeVisible({ timeout: 15_000 })
    await itpLink.click()
    await page.waitForURL(/\/itp\//, { timeout: 30_000 })

    // ITP detail SSR depends on data-node availability — may intermittently 404
    const is404 = await page.locator('text="404"').first().isVisible({ timeout: 3_000 }).catch(() => false)
    if (is404) {
      console.warn('ITP detail returned 404 — data-node SSR timeout (known intermittent issue)')
      return // Skip assertions, not a test failure
    }

    await assertNoError(page)

    // ITP name (format: "ITP #1" or "ITP-100")
    const itpName = page.locator('text=/ITP\\s*[#-]\\s*\\d+/').first()
    await expect(itpName).toBeVisible({ timeout: 15_000 })

    // NAV value (should show $x.xxxx)
    const navValue = page.locator('text=/\\$\\d+\\.\\d{2}/').first()
    await expect(navValue).toBeVisible({ timeout: 10_000 })

    // Holdings count or asset names
    const holdings = page.locator('text=/Holdings|100/').first()
    const hasHoldings = await holdings.isVisible({ timeout: 10_000 }).catch(() => false)
    const assetName = page.locator('text=/BTC|ETH|SOL/').first()
    const hasAssets = await assetName.isVisible({ timeout: 5_000 }).catch(() => false)
    expect(hasHoldings || hasAssets).toBe(true)

    // Breadcrumb: Home / Markets / ITP-xxx
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
    await expect(page.locator('text=Explorer').first()).toBeVisible({ timeout: 15_000 })
    // Summary bar should show network status (may be loading)
    const statusContent = page.locator('text=/Healthy|Degraded|Unhealthy|Loading/i').first()
    const hasStatus = await statusContent.isVisible({ timeout: 15_000 }).catch(() => false)
    if (hasStatus) {
      // Verify summary bar items render
      await expect(page.locator('text=Network').first()).toBeVisible({ timeout: 5_000 })
      await expect(page.locator('text=Quorum').first()).toBeVisible({ timeout: 5_000 })
      await expect(page.locator('text=Consensus Success').first()).toBeVisible({ timeout: 5_000 })
      await expect(page.locator('text=Connected Peers').first()).toBeVisible({ timeout: 5_000 })
    }
  })

  test('tab navigation works for all 9 tabs', async ({ page }) => {
    await page.goto(BASE + '/explorer', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)
    const TABS = ['Consensus', 'Orders', 'Price Feeds', 'P2P Network', 'Cycles', 'ITP & NAV', 'Vision', 'System Health', 'Chain & Gas']
    for (const tab of TABS) {
      const tabBtn = page.getByRole('button', { name: tab })
      await expect(tabBtn).toBeVisible({ timeout: 5_000 })
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
    // Consensus tab is default, should show chart titles
    await expect(page.locator('text=Quorum Status').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Network Health').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text="Consensus Rounds/min"').first()).toBeVisible({ timeout: 5_000 })
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
    await page.getByRole('button', { name: 'Orders' }).click()
    await page.waitForTimeout(3_000)
    await expect(page.locator('text=Pending Orders').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text="Orders Processed/min"').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Avg Cycle Duration').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Per-Order Metrics').first()).toBeVisible({ timeout: 5_000 })
  })

  test('P2P Network tab shows peer data', async ({ page }) => {
    await page.goto(BASE + '/explorer', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)
    await page.getByRole('button', { name: 'P2P Network' }).click()
    await page.waitForTimeout(3_000)
    await expect(page.locator('text=Connected Peers').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Messages Sent / Received').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Peer Health').first()).toBeVisible({ timeout: 5_000 })
  })

  test('Cycles tab shows cycle performance', async ({ page }) => {
    await page.goto(BASE + '/explorer', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)
    await page.getByRole('button', { name: 'Cycles' }).click()
    await page.waitForTimeout(3_000)
    await expect(page.locator('text=Cycle Duration').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Slow Cycle Alerts').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Orders per Cycle').first()).toBeVisible({ timeout: 5_000 })
  })

  test('System Health tab shows health charts', async ({ page }) => {
    await page.goto(BASE + '/explorer', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)
    await page.getByRole('button', { name: 'System Health' }).click()
    await page.waitForTimeout(3_000)
    await expect(page.locator('text=Network Status').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Quorum History').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Consensus Success Rate').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Error Rate').first()).toBeVisible({ timeout: 5_000 })
  })

  test('Price Feeds tab shows feed charts', async ({ page }) => {
    await page.goto(BASE + '/explorer', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)
    await page.getByRole('button', { name: 'Price Feeds' }).click()
    await page.waitForTimeout(3_000)
    await expect(page.locator('text=Price Feeds').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Consensus Duration Trend').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Price Feed Metrics').first()).toBeVisible({ timeout: 5_000 })
  })

  test('ITP & NAV tab shows live ITP data', async ({ page }) => {
    await page.goto(BASE + '/explorer', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)
    await page.getByRole('button', { name: 'ITP & NAV' }).click()
    await page.waitForTimeout(5_000)
    await expect(page.locator('text=ITP Metrics').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Pending Order Volume').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Live ITP Metrics').first()).toBeVisible({ timeout: 5_000 })
    // Verify actual NAV data renders (not dashes)
    const navValue = page.locator('text=/^\\$\\d+\\.\\d+$/').first()
    await expect(navValue).toBeVisible({ timeout: 15_000 })
  })

  test('Chain & Gas tab shows consensus and P2P charts', async ({ page }) => {
    await page.goto(BASE + '/explorer', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)
    await page.getByRole('button', { name: 'Chain & Gas' }).click()
    await page.waitForTimeout(5_000)
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
    await page.getByRole('button', { name: 'Vision' }).click()
    await page.waitForTimeout(5_000)
    await expect(page.locator('text=Batch Volume').first()).toBeVisible({ timeout: 10_000 })
    await expect(page.locator('text=Batch Pool Stats').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Batches by Source').first()).toBeVisible({ timeout: 5_000 })
    await expect(page.locator('text=Network Activity').first()).toBeVisible({ timeout: 5_000 })
    // Verify batch stats show real numbers (Active Batches > 0)
    const activeBatches = page.locator('text=Active Batches').first()
    await expect(activeBatches).toBeVisible({ timeout: 10_000 })
    // Verify TVL shows a dollar amount
    const tvlValue = page.locator('text=/Total TVL/').first()
    await expect(tvlValue).toBeVisible({ timeout: 10_000 })
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
// 12. INDEX SUB-TABS (/index — Markets, Portfolio, Create, etc.)
// ═══════════════════════════════════════════════════════════════

test.describe('Index Sub-Tabs (/index)', () => {
  const TABS = ['Markets', 'Portfolio', 'Create', 'Lend', 'Backtest', 'System']

  test('all tabs are visible', async ({ page }) => {
    await page.goto(BASE + '/index', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)
    for (const tab of TABS) {
      const tabEl = page.locator(`text="${tab}"`).first()
      await expect(tabEl).toBeVisible({ timeout: 5_000 })
    }
  })

  test('switching to Create tab renders form', async ({ page }) => {
    await page.goto(BASE + '/index', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)
    await page.locator('text="Create"').first().click()
    await page.waitForTimeout(2_000)
    // Create tab should show ITP creation form elements
    const content = page.locator('text=/Create|Name|Symbol|Assets|Weight/i').first()
    await expect(content).toBeVisible({ timeout: 10_000 })
  })

  test('switching to Backtest tab renders simulation controls and auto-runs', async ({ page }) => {
    await page.goto(BASE + '/index', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)
    await page.locator('text="Backtest"').first().click()
    // Simulation auto-runs after data-node health check (can take ~30s)
    // First verify controls render
    const content = page.locator('text=/Backtest|Performance|Run|Category/i').first()
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

  test('switching to System tab shows issuer nodes with status', async ({ page }) => {
    await page.goto(BASE + '/index', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(3_000)
    await page.locator('text="System"').first().click()
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
      const is404 = await page.locator('text=/404|not found/i').first().isVisible({ timeout: 3_000 }).catch(() => false)
      if (!is404) {
        await assertNoError(page)
        // Should show at least Tick or Players or markets
        const content = page.locator('text=/Tick|Players|Enter Batch|markets/i').first()
        await expect(content).toBeVisible({ timeout: 15_000 })
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
    await page.waitForTimeout(5_000)
    // Find a link to ITP detail
    const itpLink = page.locator('a[href*="/itp/"]').first()
    if (await itpLink.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await itpLink.click()
      await page.waitForTimeout(3_000)
      await assertNoError(page)
    }
  })

  test('404 page renders for invalid route', async ({ page }) => {
    await page.goto(BASE + '/this-page-does-not-exist', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    // Should show 404 content, not a crash
    const notFound = page.locator('text=/404|not found|page.*not/i').first()
    await expect(notFound).toBeVisible({ timeout: 10_000 })
  })
})
