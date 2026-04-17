/**
 * Portfolio tabs E2E.
 * Phase: ui-needs-state (depends on itp-data for on-chain state)
 *
 * The portfolio section lives inside HomeClient's sidebar navigation.
 * Hash-based navigation (/index#portfolio) only reads the hash on mount —
 * a same-page hash change from the fixture's /index won't re-trigger it.
 * We click the sidebar button directly instead.
 */
import { test, expect, TEST_ADDRESS } from '../fixtures/wallet'
import { ensureWalletConnected } from '../helpers/selectors'

/**
 * Activate the Portfolio section via hash navigation.
 * HomeClient reads window.location.hash on mount and sets activeSection.
 * This is more reliable than clicking a sidebar button (which depends on
 * viewport width, i18n, and Framer Motion animation timing).
 */
async function activatePortfolioSection(page: import('@playwright/test').Page) {
  // Use desktop viewport so sidebar is visible (sidebar is hidden lg:flex, breakpoint 1024px)
  await page.setViewportSize({ width: 1280, height: 800 })

  // Navigate fresh with hash — HomeClient reads window.location.hash on mount
  await page.goto('/index#portfolio', { waitUntil: 'domcontentloaded', timeout: 60_000 })

  // Wait for the portfolio section to become active.
  // Two strategies: (1) hash-based mount activation, (2) sidebar click fallback.
  const section = page.locator('#portfolio')
  try {
    await expect(section).toBeVisible({ timeout: 15_000 })
  } catch {
    // Hash didn't trigger — click the sidebar "Portfolio" button
    const sidebarBtn = page.locator('aside button, nav button').filter({ hasText: /Portfolio/i }).first()
    await sidebarBtn.click({ timeout: 10_000 }).catch(() => {})
    await expect(section).toBeVisible({ timeout: 15_000 })
  }
}

/**
 * Wait for portfolio tabs to render.
 * Tabs only appear when: (1) wallet connected, (2) usePortfolio loading finished.
 * The portfolio API has 10s per-endpoint timeout, so we allow up to 30s total.
 */
async function waitForPortfolioTabs(page: import('@playwright/test').Page) {
  const portfolio = page.locator('#portfolio')
  // The tab bar contains SpringTab buttons with text "Positions", "Trades", "Orders".
  // Wait for at least one tab to appear — signals loading is complete.
  await expect(
    portfolio.getByRole('button', { name: /Positions/i }).first()
  ).toBeVisible({ timeout: 30_000 })
}

test.describe('Portfolio & Orders', () => {
  test('Portfolio section shows tabs', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    await ensureWalletConnected(page, TEST_ADDRESS)
    await activatePortfolioSection(page)
    await waitForPortfolioTabs(page)

    // Verify all three tabs exist
    const portfolio = page.locator('#portfolio')
    await expect(portfolio.getByRole('button', { name: /Positions/i }).first()).toBeVisible()
    await expect(portfolio.getByRole('button', { name: /Trades/i }).first()).toBeVisible()
    await expect(portfolio.getByRole('button', { name: /Orders/i }).first()).toBeVisible()
  })

  test('Positions tab shows formatted values', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    await ensureWalletConnected(page, TEST_ADDRESS)
    await activatePortfolioSection(page)
    await waitForPortfolioTabs(page)

    // Positions tab is the default active tab — no click needed.
    // The tab content shows either a positions table or an empty-state CTA.
    // Either way, there must be no raw 18-digit wei values on the page.
    await expect(async () => {
      const text = await page.locator('#portfolio').textContent()
      expect(text).not.toMatch(/\d{18,}/)
    }).toPass({ timeout: 15_000 })
  })

  test('Trades tab renders', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    await ensureWalletConnected(page, TEST_ADDRESS)
    await activatePortfolioSection(page)
    await waitForPortfolioTabs(page)

    // Click the Trades tab
    const portfolio = page.locator('#portfolio')
    const tradesTab = portfolio.getByRole('button', { name: /Trades/i }).first()
    await tradesTab.click()

    // Tab rendered — content may be empty if no trades. Assert tab didn't crash.
    // Scope the wei check to the portfolio section, not the entire page.
    await expect(async () => {
      const text = await portfolio.textContent()
      expect(text).not.toMatch(/\d{18,}/)
    }).toPass({ timeout: 15_000 })
  })
})
