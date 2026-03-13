/**
 * Backtester → Deploy handoff E2E.
 * Phase: ui-verify-itp (no on-chain writes)
 */
import { test, expect, TEST_ADDRESS } from '../fixtures/wallet'
import { ensureWalletConnected } from '../helpers/selectors'

test.describe('Backtester Deploy Handoff', () => {
  test('simulation produces results with chart', async ({ walletPage: page }) => {
    test.setTimeout(180_000)

    await page.goto('/index')
    await ensureWalletConnected(page, TEST_ADDRESS)

    // Scroll to backtest section
    await page.evaluate(() => {
      const headings = document.querySelectorAll('h2')
      for (const h of headings) {
        if (h.textContent?.includes('Backtest') || h.textContent?.includes('Simulation')) {
          h.scrollIntoView()
          break
        }
      }
    })

    // BacktestSection health-checks data-node (up to 15 attempts × 2s = 30s) before rendering
    const runBtn = page.getByRole('button', { name: /Run|Simulate/i }).first()
    await expect(runBtn).toBeVisible({ timeout: 60_000 })

    await runBtn.click()

    // Wait for results — chart SVG with path elements proves sim ran
    const chartPath = page.locator('svg path[d]').first()
    await expect(chartPath).toBeVisible({ timeout: 60_000 })

    // Verify stats are rendered (returns, Sharpe ratio, etc.)
    const statsText = await page.locator('body').textContent()
    expect(statsText).toMatch(/return|sharpe|drawdown/i)
  })
})
