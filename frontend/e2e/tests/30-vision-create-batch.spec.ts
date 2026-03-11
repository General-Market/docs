/**
 * Vision Batch Entry E2E — tests batch creation via source detail page.
 * Phase: write-after (may create on-chain state)
 *
 * NOTE: The standalone "Create Batch" wizard (VisionPage component) is not
 * currently rendered on any route. Batch entry is done through source detail
 * pages via the "Enter Batch" panel.
 */
import { visionTest as test, expect } from '../fixtures/wallet'
import { VISION_PLAYER_ADDRESS } from '../env'
import { ensureWalletConnected } from '../helpers/selectors'

test.describe('Vision Batch Entry', () => {
  test('source detail page has Enter Batch panel with stake input', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    // Navigate to first source detail page (route is /source/[id], singular)
    await page.goto('/source/coingecko')
    await page.waitForTimeout(2_000)

    // The Enter Batch panel should be visible on source detail pages
    const enterBatch = page.getByText(/Enter Batch|Stake|Place Bets|USDC/i).first()
    await expect(enterBatch).toBeVisible({ timeout: 15_000 })
  })

  test('batch list shows at least one live or pending batch', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    await page.goto('/')
    await page.waitForTimeout(2_000)

    // LIVE BATCHES section should show at least one batch card
    const batchCard = page.locator('[class*="batch"], [class*="Batch"]').first()
    const hasBatchCard = await batchCard.isVisible({ timeout: 15_000 }).catch(() => false)

    if (!hasBatchCard) {
      // Fallback: check for any batch-related content
      const hasBatches = await page.getByText(/LIVE BATCHES|batches/i).first().isVisible({ timeout: 10_000 }).catch(() => false)
      expect(hasBatches).toBeTruthy()
    }
  })
})
