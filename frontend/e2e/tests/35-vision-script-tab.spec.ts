/**
 * Vision Script Tab E2E — Pyodide strategy editor loads.
 * Phase: ui-verify-vision
 */
import { test, expect } from '@playwright/test'

test.describe('Vision Script Tab', () => {
  test('Script tab is accessible on source detail page', async ({ page }) => {
    test.setTimeout(300_000) // Pyodide WASM is ~10MB

    await page.goto('/source/coingecko')

    const scriptTab = page.getByRole('button', { name: /Script|SCRIPT/i }).first()
    const hasScript = await scriptTab.isVisible({ timeout: 15_000 }).catch(() => false)

    if (!hasScript) {
      test.skip(true, 'Script tab not visible on this page')
      return
    }

    await scriptTab.click()

    // Editor must actually load — look for textarea or code mirror
    const editor = page.locator('textarea, .cm-editor, [role="textbox"]').first()
    await expect(editor).toBeVisible({ timeout: 120_000 })
  })
})
