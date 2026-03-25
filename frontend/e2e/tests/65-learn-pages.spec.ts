/**
 * Learn hub and article page smoke tests.
 *
 * The learn section is server-rendered MDX at /learn and /learn/[slug].
 * No wallet required. Tests confirm the hub lists articles and that
 * individual articles render their heading and body content.
 */
import { test, expect } from '@playwright/test'

test.describe('Learn Hub', () => {
  test('learn index page loads with heading and article listing', async ({ page }) => {
    test.setTimeout(120_000)
    const response = await page.goto('/learn', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    expect(response?.status()).toBeLessThan(500)

    // HeroBand renders an h1 with translated title
    const heading = page.locator('h1').first()
    await expect(heading).toBeVisible({ timeout: 15_000 })

    // SectionBar shows "Articles" label with a count
    await expect(page.getByText('Articles').first()).toBeVisible({ timeout: 10_000 })

    // Article links should exist — each article is an <a> pointing to /learn/{slug}
    const articleLinks = page.locator('a[href*="/learn/"]')
    const count = await articleLinks.count()
    expect(count).toBeGreaterThanOrEqual(3)
  })

  test('article page renders heading and body text', async ({ page }) => {
    test.setTimeout(120_000)
    // "what-are-itps" is a known slug from content/learn/
    const response = await page.goto('/learn/what-are-itps', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    expect(response?.status()).toBeLessThan(500)

    // ArticleHeader renders the title
    const heading = page.getByText('What Are Index Tracking Products (ITPs)?').first()
    await expect(heading).toBeVisible({ timeout: 15_000 })

    // Article body should have substantial text content (MDX rendered)
    const articleBody = page.locator('article').first()
    await expect(articleBody).toBeVisible({ timeout: 15_000 })
    const bodyText = await articleBody.textContent({ timeout: 10_000 })
    expect(bodyText!.length).toBeGreaterThan(500)

    // Sidebar with table-of-contents headings should be present (desktop)
    // h2 sections extracted from MDX appear as navigation links
    const h2Elements = articleBody.locator('h2')
    const h2Count = await h2Elements.count()
    expect(h2Count).toBeGreaterThanOrEqual(2)
  })

  test('invalid article slug returns 404 or not-found', async ({ page }) => {
    test.setTimeout(120_000)
    const response = await page.goto('/learn/nonexistent-article-slug-xyz', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    const status = response?.status() ?? 0

    // Either a 404 response or a not-found page rendered client-side
    const hasNotFound = await page.getByText(/not found|404/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false)
    expect(status === 404 || hasNotFound).toBe(true)
  })
})
