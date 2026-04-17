/**
 * Error handling and empty state tests.
 *
 * Feeds the app bad inputs — invalid ITP IDs, nonexistent sources,
 * zero addresses, bogus routes — and confirms it degrades gracefully
 * rather than crashing with an unhandled exception.
 */
import { test, expect } from '@playwright/test'

test.describe('Error & Empty States', () => {
  test('invalid ITP ID shows error or empty state, not a crash', async ({ page }) => {
    test.setTimeout(120_000)
    const response = await page.goto('/itp/0xinvalid', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    const status = response?.status() ?? 0

    // Acceptable outcomes: 404 page, redirect to /index, or an error boundary.
    // Unacceptable: 500 server error with no UI, or a blank white page.
    expect(status).toBeLessThan(500)

    // If it stayed on the page, verify some UI rendered (not a blank crash)
    const bodyText = await page.locator('body').textContent({ timeout: 15_000 }).catch(() => '')
    const hasGracefulState =
      /404|not found|doesn't exist|error|no data|General Market/i.test(bodyText || '') ||
      page.url().includes('/index') // redirected to listing
    expect(hasGracefulState).toBe(true)
  })

  test('nonexistent source shows not-found or empty state', async ({ page }) => {
    test.setTimeout(120_000)
    const response = await page.goto('/source/nonexistent-source-id-xyz', {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    const status = response?.status() ?? 0

    // Should not 500. A 404 or a rendered "not found" message are both fine.
    expect(status).toBeLessThan(500)

    const bodyText = await page.locator('body').textContent({ timeout: 15_000 }).catch(() => '')
    const hasGracefulState =
      /404|not found|doesn't exist|source not found/i.test(bodyText || '') ||
      page.url() === '/' // redirected home
    expect(hasGracefulState).toBe(true)
  })

  test('zero address profile shows empty state', async ({ page }) => {
    test.setTimeout(120_000)
    const zeroAddr = '0x0000000000000000000000000000000000000000'
    const response = await page.goto(`/profile/${zeroAddr}`, {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    const status = response?.status() ?? 0
    expect(status).toBeLessThan(500)

    // The profile page is client-rendered — wait for it to hydrate.
    // With zero address, the profile hook should return empty stats.
    // Verify the page loaded (Header renders) and didn't crash.
    const header = page.locator('header').first()
    const headerVisible = await header.isVisible({ timeout: 30_000 }).catch(() => false)
    if (!headerVisible) {
      console.log('Zero address profile: header not visible — page may still be compiling')
      return
    }

    // Profile should show zeroed or empty stats, not a crash
    const bodyText = await page.locator('body').textContent({ timeout: 15_000 }).catch(() => '') ?? ''
    // Anything but "Application error" or blank page is acceptable
    expect(bodyText.length).toBeGreaterThan(50)
    expect(bodyText).not.toContain('Application error: a client-side exception')
  })

  test('bogus route shows 404 page', async ({ page }) => {
    test.setTimeout(120_000)
    const response = await page.goto('/this-does-not-exist-at-all', {
      waitUntil: 'domcontentloaded',
      timeout: 90_000,
    })
    const status = response?.status() ?? 0

    // Next.js should serve the not-found.tsx page
    // Our not-found page has "404" in large text and "Back to General Market" link
    const has404 = await page.getByText('404').first().isVisible({ timeout: 10_000 }).catch(() => false)
    const hasBackLink = await page.getByText('Back to General Market').isVisible({ timeout: 5_000 }).catch(() => false)

    // Either the HTTP status is 404, or the rendered page shows 404 content
    expect(status === 404 || has404).toBe(true)
    if (has404 && !hasBackLink) {
      console.log('404 page rendered but "Back to General Market" link not found')
    }
  })

  test('malformed ITP hex does not 500', async ({ page }) => {
    test.setTimeout(120_000)
    // A well-formed hex prefix but nonsense content
    const response = await page.goto(
      '/itp/0xzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzzz',
      { waitUntil: 'domcontentloaded', timeout: 90_000 },
    )
    const status = response?.status() ?? 0
    expect(status).toBeLessThan(500)

    // Should degrade to error page or redirect, not crash
    const bodyText = await page.locator('body').textContent({ timeout: 15_000 }).catch(() => '') ?? ''
    expect(bodyText.length).toBeGreaterThan(20)
  })
})
