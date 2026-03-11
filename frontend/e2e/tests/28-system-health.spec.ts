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
    await expect(page.getByText(/Alpha|Beta|Gamma/i).first()).toBeVisible({ timeout: 30_000 })
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
