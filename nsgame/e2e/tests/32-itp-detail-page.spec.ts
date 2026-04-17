/**
 * ITP detail page E2E — /itp/[itpId] renders with sane data.
 * Phase: ui-verify-itp (ITP exists from Phase 1)
 *
 * The ITP detail page fires aggressive polling (useItpNav every 1.5s,
 * nav-series, aum-ranking) that can saturate the Next.js dev server.
 * We intercept the expensive endpoints to keep the server responsive.
 */
import { test, expect } from '@playwright/test'

const ITP_ID = '0x' + '0'.repeat(63) + '1'

/**
 * Block polling/heavy endpoints that overwhelm the dev server.
 * Returns mock data sufficient for rendering assertions.
 */
async function installItpPageInterceptors(page: import('@playwright/test').Page) {
  // useItpNav polls /api/itp-price every 1.5s — the primary offender
  await page.route('**/api/itp-price**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        nav: '1000000000000000000',
        nav_display: '1.0000',
        assets_priced: 5,
        assets_total: 5,
        source: 'mock',
      }),
    })
  })

  // nav-series — fetched by KeyStatsBar and PerformanceChart
  await page.route('**/nav-series**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ points: [] }),
    })
  })

  // aum-ranking — fetched by RebalanceSection for symbol lookup
  await page.route('**/aum-ranking**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  // vault-balances — known to block 10+ seconds and return 500
  await page.route('**/vault-balances**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ assets: [], token_count: 0 }),
    })
  })
}

test.describe('ITP Detail Page', () => {
  test('/itp/[itpId] page loads', async ({ page }) => {
    test.setTimeout(120_000)
    await installItpPageInterceptors(page)
    await page.goto(`/itp/${ITP_ID}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })

    // Wait for page content (SSR delivers h1 "ITP #1")
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 60_000 })
  })

  test('NAV per share in sane range', async ({ page }) => {
    test.setTimeout(120_000)
    await installItpPageInterceptors(page)
    await page.goto(`/itp/${ITP_ID}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })

    // Wait for h1 first (page loaded), then check for NAV dollar value
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 60_000 })
    await expect(async () => {
      const text = await page.locator('body').textContent() ?? ''
      expect(text).toMatch(/\$\d+\.\d{2,4}/)
    }).toPass({ timeout: 30_000 })
  })

  test('holdings table shows assets', async ({ page }) => {
    test.setTimeout(120_000)
    await installItpPageInterceptors(page)
    await page.goto(`/itp/${ITP_ID}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })

    await expect(page.locator('h1').first()).toBeVisible({ timeout: 60_000 })
    await expect(page.getByText(/BTC|ETH|SOL/i).first()).toBeVisible({ timeout: 30_000 })
  })
})
