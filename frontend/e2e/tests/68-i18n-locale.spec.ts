/**
 * i18n locale routing smoke tests.
 *
 * Routes use [locale] prefix with localePrefix: 'as-needed' — the default
 * locale (en) is served without prefix, non-default locales (ko, ja, zh)
 * use explicit prefixes. Middleware rewrites bare paths to /en/... internally.
 *
 * No wallet required. Tests confirm locale routing doesn't crash the app.
 */
import { test, expect } from '@playwright/test'

test.describe('i18n Locale Routing', () => {
  test('default locale (en) loads without prefix', async ({ page }) => {
    test.setTimeout(120_000)
    const response = await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    expect(response?.status()).toBeLessThan(500)

    // Root page should load Vision content (source cards or heading)
    await expect(page.locator('h1, h2, [data-testid="source-card"]').first()).toBeVisible({ timeout: 15_000 })

    // URL should NOT have /en/ prefix (localePrefix: 'as-needed' hides default)
    expect(page.url()).not.toMatch(/\/en\//)
  })

  test('explicit /ko/ locale loads without crash', async ({ page }) => {
    test.setTimeout(120_000)
    const response = await page.goto('/ko/', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    expect(response?.status()).toBeLessThan(500)

    // Page should render — Korean locale should still show structural elements
    await expect(page.locator('h1, h2, [data-testid="source-card"]').first()).toBeVisible({ timeout: 15_000 })

    // Body should have non-trivial content (not a blank crash page)
    const bodyText = await page.locator('main, body').first().textContent({ timeout: 10_000 })
    expect(bodyText!.length).toBeGreaterThan(50)
  })

  test('explicit /ja/ locale loads without crash', async ({ page }) => {
    test.setTimeout(120_000)
    const response = await page.goto('/ja/', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    expect(response?.status()).toBeLessThan(500)

    // Structural elements should render in Japanese locale
    await expect(page.locator('h1, h2, [data-testid="source-card"]').first()).toBeVisible({ timeout: 15_000 })

    const bodyText = await page.locator('main, body').first().textContent({ timeout: 10_000 })
    expect(bodyText!.length).toBeGreaterThan(50)
  })

  test('invalid locale falls back gracefully', async ({ page }) => {
    test.setTimeout(120_000)
    // /xx/ is not a valid locale — middleware should not match it as a locale
    // and will rewrite to /en/xx/ which should 404 or show the path as a page
    const response = await page.goto('/xx/', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    const status = response?.status() ?? 0

    // Should not be a server error — either 404 (not-found page) or 200 (fallback)
    expect(status).toBeLessThan(500)

    // The app should not crash — some visible content should exist
    const hasContent = await page.locator('body').textContent({ timeout: 10_000 })
    expect(hasContent!.length).toBeGreaterThan(0)
  })
})
