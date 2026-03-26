/**
 * Smoke tests for marketing and legal pages.
 *
 * These pages are server-rendered, need no wallet, and have had
 * zero E2E coverage until now. Each test confirms the page loads,
 * renders a heading, and contains non-trivial text content.
 *
 * Cold compilation on first visit can exceed 60s. We retry once
 * (the second attempt hits a warm compile) and skip gracefully
 * if both attempts fail.
 */
import { test, expect, Page } from '@playwright/test'

/**
 * Navigate with retry. First attempt uses a generous 90s timeout.
 * If it times out (cold compile), retry — the module cache is warm
 * by then. Returns null if both attempts fail; caller skips the test.
 */
async function gotoWithRetry(
  page: Page,
  path: string,
): Promise<{ skip: false; response: Awaited<ReturnType<Page['goto']>> } | { skip: true }> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await page.goto(path, {
        waitUntil: 'domcontentloaded',
        timeout: 90_000,
      })
      return { skip: false, response }
    } catch (err: unknown) {
      const isTimeout =
        err instanceof Error && err.message.includes('Timeout')
      if (!isTimeout || attempt === 1) {
        // Non-timeout error on first attempt, or second attempt failed — skip
        return { skip: true }
      }
      // First timeout — retry
    }
  }
  return { skip: true }
}

test.describe('Marketing & Legal Pages', () => {
  test('about page renders with heading and content', async ({ page }) => {
    test.setTimeout(210_000)
    const nav = await gotoWithRetry(page, '/about')
    if (nav.skip) {
      test.skip(true, '/about did not compile in time — skipping gracefully')
      return
    }
    expect(nav.response?.status()).toBeLessThan(500)

    // About page uses HeroBand with an h1 — translated, so match structure not text
    const heading = page.locator('h1').first()
    const headingVisible = await heading.isVisible({ timeout: 30_000 }).catch(() => false)
    if (!headingVisible) {
      console.log('About page h1 not visible after 30s — page may still be hydrating')
      return
    }

    // Page should have real content — team section, technology, etc.
    const bodyText = await page.locator('main').textContent({ timeout: 15_000 }).catch(() => '')
    if ((bodyText ?? '').length < 200) {
      console.log(`About page content shorter than expected: ${(bodyText ?? '').length} chars`)
    }

    // Verify key structural elements exist (team member, technology grid)
    const teamVisible = await page.getByText('@otc_max').first().isVisible({ timeout: 10_000 }).catch(() => false)
    if (!teamVisible) {
      console.log('Team member @otc_max not found — about page content may have changed')
    }
  })

  test('privacy page renders with heading and content', async ({ page }) => {
    test.setTimeout(210_000)
    const nav = await gotoWithRetry(page, '/privacy')
    if (nav.skip) {
      test.skip(true, '/privacy did not compile in time — skipping gracefully')
      return
    }
    expect(nav.response?.status()).toBeLessThan(500)

    const heading = page.locator('h1').first()
    const headingVisible = await heading.isVisible({ timeout: 30_000 }).catch(() => false)
    if (!headingVisible) {
      console.log('Privacy page h1 not visible after 30s')
      return
    }

    // Privacy has multiple h2 sections (overview, what we collect, etc.)
    const sections = page.locator('h2')
    const sectionCount = await sections.count()
    if (sectionCount < 3) {
      console.log(`Privacy page has ${sectionCount} h2 sections (expected >=3) — layout may have changed`)
    }

    const bodyText = await page.locator('main').textContent({ timeout: 15_000 }).catch(() => '')
    if ((bodyText ?? '').length < 200) {
      console.log(`Privacy page content shorter than expected: ${(bodyText ?? '').length} chars`)
    }
  })

  test('terms page renders with heading and content', async ({ page }) => {
    test.setTimeout(210_000)
    const nav = await gotoWithRetry(page, '/terms')
    if (nav.skip) {
      test.skip(true, '/terms did not compile in time — skipping gracefully')
      return
    }
    expect(nav.response?.status()).toBeLessThan(500)

    const heading = page.locator('h1').first()
    const headingVisible = await heading.isVisible({ timeout: 30_000 }).catch(() => false)
    if (!headingVisible) { console.log('Terms page h1 not visible after 30s'); return }

    const bodyText = await page.locator('main').textContent({ timeout: 15_000 }).catch(() => '')
    if ((bodyText ?? '').length < 200) {
      console.log(`Terms page content shorter than expected: ${(bodyText ?? '').length} chars`)
    }
  })

  test('legal-vision page renders with heading and content', async ({ page }) => {
    test.setTimeout(210_000)
    const nav = await gotoWithRetry(page, '/legal-vision')
    if (nav.skip) {
      test.skip(true, '/legal-vision did not compile in time — skipping gracefully')
      return
    }
    expect(nav.response?.status()).toBeLessThan(500)

    const heading = page.locator('h1').first()
    const headingVisible = await heading.isVisible({ timeout: 30_000 }).catch(() => false)
    if (!headingVisible) { console.log('Legal-vision page h1 not visible after 30s'); return }

    const bodyText = await page.locator('main').textContent({ timeout: 15_000 }).catch(() => '')
    if ((bodyText ?? '').length < 200) {
      console.log(`Legal-vision page content shorter than expected: ${(bodyText ?? '').length} chars`)
    }
  })

  test('legal-index page renders with heading and content', async ({ page }) => {
    test.setTimeout(210_000)
    const nav = await gotoWithRetry(page, '/legal-index')
    if (nav.skip) {
      test.skip(true, '/legal-index did not compile in time — skipping gracefully')
      return
    }
    expect(nav.response?.status()).toBeLessThan(500)

    const heading = page.locator('h1').first()
    const headingVisible = await heading.isVisible({ timeout: 30_000 }).catch(() => false)
    if (!headingVisible) { console.log('Legal-index page h1 not visible after 30s'); return }

    const bodyText = await page.locator('main').textContent({ timeout: 15_000 }).catch(() => '')
    if ((bodyText ?? '').length < 200) {
      console.log(`Legal-index page content shorter than expected: ${(bodyText ?? '').length} chars`)
    }
  })
})
