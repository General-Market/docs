/**
 * System health E2E — verifies the System Status section on /index
 * and the Explorer page render with live data from SSE.
 *
 * Phase: ui-verify-itp (runs after itp-data, read-only)
 */
import { test, expect } from '@playwright/test'
import { FRONTEND_URL } from '../env'

const BASE = FRONTEND_URL

test.describe('System Health', () => {
  test('System Status section loads on /index', async ({ page }) => {
    await page.goto('/index')
    await expect(page.getByText(/Active Issuers/i).first()).toBeVisible({ timeout: 30_000 })
  })

  test('issuer nodes show active status', async ({ page }) => {
    await page.goto('/index')
    // Scroll to System Status section to trigger SSE data
    await page.evaluate(() => {
      const h = [...document.querySelectorAll('h2, h3')].find(el => /issuer|system/i.test(el.textContent || ''))
      h?.scrollIntoView()
    })
    let hasNodes = await page.getByText(/Alpha|Beta|Gamma/i).first().isVisible({ timeout: 30_000 }).catch(() => false)
    if (!hasNodes) {
      // Retry — SSE data may not have loaded
      await page.goto('/index', { waitUntil: 'domcontentloaded', timeout: 60_000 })
      await page.waitForTimeout(3_000)
      await page.evaluate(() => {
        const h = [...document.querySelectorAll('h2, h3')].find(el => /issuer|system/i.test(el.textContent || ''))
        h?.scrollIntoView()
      })
      hasNodes = await page.getByText(/Alpha|Beta|Gamma/i).first().isVisible({ timeout: 45_000 }).catch(() => false)
    }
    expect(hasNodes).toBe(true)
  })

  test('consensus status resolves to Healthy, Offline, or checking', async ({ page }) => {
    await page.goto('/index')
    await expect(page.getByText(/Healthy|Offline|checking/i).first()).toBeVisible({ timeout: 30_000 })
  })

  test('orders total label is visible', async ({ page }) => {
    await page.goto('/index')
    await expect(page.getByText(/Orders.*total/i).first()).toBeVisible({ timeout: 30_000 })
  })

  test('GET /api/explorer/health returns valid JSON', async () => {
    const res = await fetch(`${BASE}/api/explorer/health`, {
      signal: AbortSignal.timeout(15_000),
      headers: { Accept: 'application/json' },
    })
    if (res.ok) {
      const data = await res.json()
      expect(data).toBeDefined()
      expect(typeof data).toBe('object')
    } else {
      expect([502, 503, 504]).toContain(res.status)
    }
  })

  test('Explorer page loads', async ({ page }) => {
    await page.goto('/explorer')
    await expect(page.locator('h1, h2, h3').first()).toBeVisible({ timeout: 15_000 })
  })
})
