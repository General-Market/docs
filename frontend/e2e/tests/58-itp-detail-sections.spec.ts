/**
 * ITP detail page deep section verification — /itp/[itpId].
 *
 * Tests 32 and 47 verify basic load and NAV. This suite walks the tab
 * navigation (Overview, Performance, Holdings, Key Facts), verifies each
 * section renders, and checks for raw wei values.
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

  await page.route('**/nav-series**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ points: [] }),
    })
  })

  await page.route('**/aum-ranking**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([]),
    })
  })

  await page.route('**/vault-balances**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ assets: [], token_count: 0 }),
    })
  })
}

test.describe('ITP Detail Page Sections', () => {
  test('tab navigation renders four anchor tabs', async ({ page }) => {
    test.setTimeout(120_000)
    await installItpPageInterceptors(page)
    await page.goto(`/itp/${ITP_ID}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 60_000 })

    const expectedTabs = ['Overview', 'Performance', 'Holdings', 'Key Facts']
    for (const label of expectedTabs) {
      await expect(
        page.getByRole('button', { name: label }).or(page.getByRole('tab', { name: label }))
      ).toBeVisible({ timeout: 15_000 })
    }
  })

  test('KeyStatsBar shows NAV and stat labels', async ({ page }) => {
    test.setTimeout(120_000)
    await installItpPageInterceptors(page)
    await page.goto(`/itp/${ITP_ID}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 60_000 })

    await expect(page.getByText(/NAV \/ Share/i).first()).toBeVisible({ timeout: 30_000 })
    await expect(page.getByText(/Holdings/i).first()).toBeVisible({ timeout: 15_000 })
  })

  test('clicking Holdings tab reveals asset table', async ({ page }) => {
    test.setTimeout(120_000)
    await installItpPageInterceptors(page)
    await page.goto(`/itp/${ITP_ID}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 60_000 })

    const holdingsTab = page.getByRole('button', { name: 'Holdings' }).or(
      page.getByRole('tab', { name: 'Holdings' })
    )
    await holdingsTab.click()

    await expect(
      page.getByText(/BTC|ETH|SOL/i).first()
    ).toBeVisible({ timeout: 30_000 })
  })

  test('clicking Performance tab reveals chart area', async ({ page }) => {
    test.setTimeout(120_000)
    await installItpPageInterceptors(page)
    await page.goto(`/itp/${ITP_ID}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 60_000 })

    const perfTab = page.getByRole('button', { name: 'Performance' }).or(
      page.getByRole('tab', { name: 'Performance' })
    )
    await perfTab.click()

    await expect(
      page.getByText(/Since Inception|1D|7D|90D/i).first()
    ).toBeVisible({ timeout: 30_000 })
  })

  test('clicking Key Facts tab reveals FundFacts section', async ({ page }) => {
    test.setTimeout(120_000)
    await installItpPageInterceptors(page)
    await page.goto(`/itp/${ITP_ID}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 60_000 })

    const factsTab = page.getByRole('button', { name: 'Key Facts' }).or(
      page.getByRole('tab', { name: 'Key Facts' })
    )
    await factsTab.click()

    await expect(
      page.getByText(/Fund Details|Fund Inception|Chain|Settlement Address/i).first()
    ).toBeVisible({ timeout: 30_000 })
  })

  test('no raw wei values in visible text', async ({ page }) => {
    test.setTimeout(120_000)
    await installItpPageInterceptors(page)
    await page.goto(`/itp/${ITP_ID}`, { waitUntil: 'domcontentloaded', timeout: 90_000 })
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 60_000 })

    await page.waitForTimeout(3_000)

    const bodyText = await page.locator('body').textContent() ?? ''
    const rawWeiPattern = /(?<![0-9a-fA-Fx])\d{18,}(?![0-9a-fA-Fx])/
    const matches = bodyText.match(rawWeiPattern)
    expect(matches, `Raw wei value on ITP detail: ${matches?.[0]?.slice(0, 30)}`).toBeNull()
  })
})
