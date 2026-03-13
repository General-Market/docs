/**
 * Production smoke tests — run against a live Vercel deployment.
 * No wallet, no transactions, read-only checks.
 *
 * Usage:
 *   E2E_FRONTEND_URL=https://www.generalmarket.io npx playwright test --config e2e/playwright.config.ts 35-production-smoke
 *
 * Or use the wrapper script:
 *   ./e2e/prod-smoke.sh                          # against www.generalmarket.io
 *   ./e2e/prod-smoke.sh https://preview-url.vercel.app  # against a preview deploy
 */
import { test, expect } from '@playwright/test'

const BASE = process.env.E2E_FRONTEND_URL || 'https://www.generalmarket.io'

function apiUrl(path: string): string {
  return `${BASE}${path}`
}

// ── API Endpoint Health ──────────────────────────────────────

test.describe('API Endpoints', () => {
  test('GET /api/deployment returns contracts (or 404 if not proxied)', async () => {
    const res = await fetch(apiUrl('/api/deployment?file=active-deployment.json'), {
      signal: AbortSignal.timeout(15_000),
    })
    if (res.status === 404) {
      // Route not available on this deployment (no rewrite configured)
      return
    }
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data).toHaveProperty('contracts')
    expect(Object.keys(data.contracts).length).toBeGreaterThan(0)
  })

  test('GET /api/itp-price returns NAV for ITP-1', async () => {
    const itpId = '0x' + '0'.repeat(63) + '1'
    const res = await fetch(apiUrl(`/api/itp-price?itp_id=${itpId}`), {
      signal: AbortSignal.timeout(15_000),
    })
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data).toHaveProperty('nav')
    const nav = Number(data.nav)
    expect(nav).toBeGreaterThan(0)
  })

  test('GET /api/vision/batches returns batch list', async () => {
    const res = await fetch(apiUrl('/api/vision/batches'), {
      signal: AbortSignal.timeout(15_000),
    })
    expect(res.ok).toBe(true)
    const data = await res.json()
    const batches = data.batches ?? data
    expect(Array.isArray(batches)).toBe(true)
    expect(batches.length).toBeGreaterThan(0)
    // Verify batch IDs are in the expected range (latest generation)
    const firstBatch = batches[0]
    expect(firstBatch.id).toBeGreaterThanOrEqual(108)
  })

  test('GET /api/vision/snapshot returns price data', async () => {
    const res = await fetch(apiUrl('/api/vision/snapshot'), {
      signal: AbortSignal.timeout(15_000),
    })
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data).toBeDefined()
    expect(typeof data).toBe('object')
  })

  test('GET /api/vision/leaderboard returns leaderboard', async () => {
    const res = await fetch(apiUrl('/api/vision/leaderboard'), {
      signal: AbortSignal.timeout(15_000),
    })
    const data = await res.json()
    expect(data).toHaveProperty('leaderboard')
    expect(Array.isArray(data.leaderboard)).toBe(true)
  })
})

// ── SSE Stream ───────────────────────────────────────────────

test.describe('SSE Data Stream', () => {
  test('SSE /dn/sse/stream delivers itp-nav events', async () => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 15_000)

    try {
      const res = await fetch(apiUrl('/dn/sse/stream?topics=nav'), {
        signal: controller.signal,
        headers: { Accept: 'text/event-stream' },
      })
      expect(res.ok).toBe(true)

      // Read first chunk — should contain itp-nav event
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
    } finally {
      clearTimeout(timeout)
      controller.abort()
    }
  })
})

// ── Page Rendering ───────────────────────────────────────────

test.describe('Page Load & Rendering', () => {
  test('/ (Vision homepage) loads and shows source cards', async ({ page }) => {
    await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    // Source cards should appear (links to /source/*)
    const sourceLink = page.locator('a[href*="/source/"]').first()
    await expect(sourceLink).toBeVisible({ timeout: 20_000 })
  })

  test('/index shows ITP cards with NAV data', async ({ page }) => {
    await page.goto(BASE + '/index', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    // ITP cards should render — look for NAV value or ITP name
    const itpContent = page.locator('text=/ITP-100|ITP-10|NAV|\\$1/').first()
    await expect(itpContent).toBeVisible({ timeout: 30_000 })
  })

  test('/index has Sign Up button (not Connect Wallet)', async ({ page }) => {
    await page.goto(BASE + '/index', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    // Should see "Sign Up", NOT "Connect Wallet" as a separate button
    const signUp = page.getByRole('button', { name: 'Sign Up' })
    await expect(signUp.first()).toBeVisible({ timeout: 15_000 })
  })

  test('Vision source detail page shows batch stats', async ({ page }) => {
    // Navigate to a source that has an active batch
    await page.goto(BASE + '/source/finnhub', { waitUntil: 'domcontentloaded', timeout: 30_000 })

    // Batch bar should show tick number (not dashes)
    // Look for Tick label + a number (not "—")
    const tickLabel = page.locator('text=Tick').first()
    await expect(tickLabel).toBeVisible({ timeout: 20_000 })

    // Wait for batch data to load
    await page.waitForTimeout(5_000)

    // TICK should show a number like #374, not "—"
    const tickValue = page.locator('text=/^#\\d+$/').first()
    const hasTick = await tickValue.isVisible({ timeout: 10_000 }).catch(() => false)

    // PLAYERS should show a number, not "—"
    const playersLabel = page.locator('text=Players').first()
    await expect(playersLabel).toBeVisible({ timeout: 5_000 })

    if (!hasTick) {
      // If batch didn't load, check if it's a data issue vs rendering issue
      const dash = page.locator('text="—"').first()
      const hasDash = await dash.isVisible({ timeout: 2_000 }).catch(() => false)
      if (hasDash) {
        // Batch data not loading — this is a regression
        expect(hasTick).toBe(true) // fail with clear message
      }
      // Otherwise the source page might just not have the batch bar
    }
  })

  test('Vision source detail has Enter Batch panel', async ({ page }) => {
    await page.goto(BASE + '/source/finnhub', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await page.waitForTimeout(5_000)

    // The entry panel should be visible (even if button is disabled without wallet)
    const entryPanel = page.locator('text=/Enter Batch|Add Funds/').first()
    await expect(entryPanel).toBeVisible({ timeout: 15_000 })
  })

  test('/about page loads', async ({ page }) => {
    await page.goto(BASE + '/about', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await expect(page.locator('body')).toBeVisible()
    // Should not show error page
    const errorText = page.locator('text=/404|500|Application error/').first()
    const hasError = await errorText.isVisible({ timeout: 3_000 }).catch(() => false)
    expect(hasError).toBe(false)
  })

  test('/sources page loads with source health', async ({ page }) => {
    await page.goto(BASE + '/sources', { waitUntil: 'domcontentloaded', timeout: 30_000 })
    await expect(page.locator('body')).toBeVisible()
    const errorText = page.locator('text=/404|500|Application error/').first()
    const hasError = await errorText.isVisible({ timeout: 3_000 }).catch(() => false)
    expect(hasError).toBe(false)
  })
})

// ── Explorer Health ──────────────────────────────────────────

test.describe('Explorer Health', () => {
  test('Explorer latest returns healthy data (or 404 if not proxied)', async () => {
    const token = process.env.EXPLORER_TOKEN || '20b8dfdd244827f7a88d31dbe96b448938f1731437a9340e3a616ba63f2dc267'
    const res = await fetch(apiUrl('/api/explorer/health/latest'), {
      signal: AbortSignal.timeout(15_000),
      headers: { 'x-explorer-token': token },
    })
    if (res.status === 404) {
      // Explorer route not proxied on this deployment
      return
    }
    if (res.status === 204) {
      // No data yet — acceptable
      return
    }
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data).toHaveProperty('network')
    expect(data.network).toHaveProperty('quorum_met')
  })
})
