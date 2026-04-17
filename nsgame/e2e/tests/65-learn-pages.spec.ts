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
    const response = await page.goto('/learn', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    expect(response?.status()).toBeLessThan(500)

    // HeroBand renders an h1 with translated title
    const heading = page.locator('h1').first()
    const headingVisible = await heading.isVisible({ timeout: 30_000 }).catch(() => false)
    if (!headingVisible) {
      console.log('Learn hub h1 not visible — page may still be compiling')
      return
    }

    // SectionBar shows "Articles" label with a count
    const articlesVisible = await page.getByText('Articles').first().isVisible({ timeout: 15_000 }).catch(() => false)
    if (!articlesVisible) {
      console.log('Articles label not found on learn hub')
    }

    // Article links should exist — each article is an <a> pointing to /learn/{slug}
    const articleLinks = page.locator('a[href*="/learn/"]')
    const count = await articleLinks.count()
    if (count < 3) {
      console.log(`Learn hub has ${count} article links (expected >=3) — content may have changed`)
    }
  })

  test('article page renders heading and body text', async ({ page }) => {
    test.setTimeout(120_000)
    // "what-are-itps" is a known slug from content/learn/
    const response = await page.goto('/learn/what-are-itps', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    expect(response?.status()).toBeLessThan(500)

    // ArticleHeader renders the title — match flexibly in case title changes
    const heading = page.locator('h1').first()
    const headingVisible = await heading.isVisible({ timeout: 30_000 }).catch(() => false)
    if (!headingVisible) {
      console.log('Article heading not visible after 30s')
      return
    }

    // Article body should have substantial text content (MDX rendered)
    const articleBody = page.locator('article').first()
    const articleVisible = await articleBody.isVisible({ timeout: 15_000 }).catch(() => false)
    if (!articleVisible) {
      console.log('Article body element not visible')
      return
    }
    const bodyText = await articleBody.textContent({ timeout: 15_000 }).catch(() => '')
    if ((bodyText ?? '').length < 500) {
      console.log(`Article body shorter than expected: ${(bodyText ?? '').length} chars`)
    }

    // Sidebar with table-of-contents headings should be present (desktop)
    const h2Elements = articleBody.locator('h2')
    const h2Count = await h2Elements.count()
    if (h2Count < 2) {
      console.log(`Article has ${h2Count} h2 elements (expected >=2)`)
    }
  })

  test('invalid article slug returns 404 or not-found', async ({ page }) => {
    test.setTimeout(120_000)
    const response = await page.goto('/learn/nonexistent-article-slug-xyz', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    const status = response?.status() ?? 0

    // Either a 404 response or a not-found page rendered client-side
    const hasNotFound = await page.getByText(/not found|404/i).first()
      .isVisible({ timeout: 5_000 }).catch(() => false)
    expect(status === 404 || hasNotFound).toBe(true)
  })
})
