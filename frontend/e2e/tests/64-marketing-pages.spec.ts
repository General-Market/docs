/**
 * Smoke tests for marketing and legal pages.
 *
 * These pages are server-rendered, need no wallet, and have had
 * zero E2E coverage until now. Each test confirms the page loads,
 * renders a heading, and contains non-trivial text content.
 */
import { test, expect } from '@playwright/test'

test.describe('Marketing & Legal Pages', () => {
  test('about page renders with heading and content', async ({ page }) => {
    test.setTimeout(120_000)
    const response = await page.goto('/about', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    expect(response?.status()).toBeLessThan(500)

    // About page uses HeroBand with an h1 — translated, so match structure not text
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 15_000 })

    // Page should have real content — team section, technology, etc.
    const bodyText = await page.locator('main').textContent({ timeout: 10_000 })
    expect(bodyText!.length).toBeGreaterThan(200)

    // Verify key structural elements exist (team member, technology grid)
    await expect(page.getByText('@otc_max').first()).toBeVisible()
  })

  test('privacy page renders with heading and content', async ({ page }) => {
    test.setTimeout(120_000)
    const response = await page.goto('/privacy', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    expect(response?.status()).toBeLessThan(500)

    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 15_000 })

    // Privacy has multiple h2 sections (overview, what we collect, etc.)
    const sections = page.locator('h2')
    const sectionCount = await sections.count()
    expect(sectionCount).toBeGreaterThanOrEqual(3)

    const bodyText = await page.locator('main').textContent({ timeout: 10_000 })
    expect(bodyText!.length).toBeGreaterThan(200)
  })

  test('terms page renders with heading and content', async ({ page }) => {
    test.setTimeout(120_000)
    const response = await page.goto('/terms', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    expect(response?.status()).toBeLessThan(500)

    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 15_000 })

    const bodyText = await page.locator('main').textContent({ timeout: 10_000 })
    expect(bodyText!.length).toBeGreaterThan(200)
  })

  test('legal-vision page renders with heading and content', async ({ page }) => {
    test.setTimeout(120_000)
    const response = await page.goto('/legal-vision', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    expect(response?.status()).toBeLessThan(500)

    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 15_000 })

    const bodyText = await page.locator('main').textContent({ timeout: 10_000 })
    expect(bodyText!.length).toBeGreaterThan(200)
  })

  test('legal-index page renders with heading and content', async ({ page }) => {
    test.setTimeout(120_000)
    const response = await page.goto('/legal-index', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    expect(response?.status()).toBeLessThan(500)

    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 15_000 })

    const bodyText = await page.locator('main').textContent({ timeout: 10_000 })
    expect(bodyText!.length).toBeGreaterThan(200)
  })
})
