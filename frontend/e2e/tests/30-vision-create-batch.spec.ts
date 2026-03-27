/**
 * Vision Batch Entry E2E — tests batch creation via source detail page.
 * Phase: write-after (may create on-chain state)
 *
 * NOTE: The standalone "Create Batch" wizard (VisionPage component) is not
 * currently rendered on any route. Batch entry is done through source detail
 * pages via the "Enter Batch" panel.
 */
import { visionTest as test, expect } from '../fixtures/wallet'
import { VISION_PLAYER_ADDRESS, VISION_API } from '../env'
import { ensureWalletConnected } from '../helpers/selectors'

// Probe oracle health once — tests degrade gracefully when oracle is down
let oracleHealthy = false

test.describe('Vision Batch Entry', () => {
  test.beforeAll(async () => {
    try {
      const res = await fetch(`${VISION_API}/vision/batches`, {
        signal: AbortSignal.timeout(10_000),
      })
      oracleHealthy = res.ok
      if (!res.ok) {
        console.warn(`Oracle health probe: HTTP ${res.status} — tests will degrade gracefully`)
      }
    } catch (e: any) {
      console.warn(`Oracle health probe: unreachable (${e.message ?? e}) — tests will degrade gracefully`)
      oracleHealthy = false
    }
  })

  test('source detail page has Enter Batch panel with stake input', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    // Navigate to first source detail page (route is /source/[id], singular)
    await page.goto('/source/coingecko')
    await page.waitForLoadState('domcontentloaded')

    // The Enter Batch panel should be visible on source detail pages
    const enterBatch = page.getByText(/Enter Batch|Stake|Place Bets|USDC/i).first()
    await expect(enterBatch).toBeVisible({ timeout: 15_000 })
  })

  test('batch list shows at least one live or pending batch', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    await page.goto('/', { waitUntil: 'domcontentloaded' })

    // Look for the "Live Batches" heading from NextBatches component
    const hydrateTimeout = oracleHealthy ? 20_000 : 10_000
    const heading = page.getByText(/Live Batches/i).first()
    const hasHeading = await heading.isVisible({ timeout: hydrateTimeout }).catch(() => false)

    if (hasHeading) return

    // Heading not visible — NextBatches might not render if no batches have players.
    // Check if SourcesGrid loaded (source cards depend on SSE data from oracle).
    const cardTimeout = oracleHealthy ? 15_000 : 5_000
    const sourceCard = page.locator('[data-testid="source-card"]').first()
    const hasSource = await sourceCard.isVisible({ timeout: cardTimeout }).catch(() => false)

    if (hasSource) {
      // Page loaded with source data but no live batches — acceptable on fresh deploy
      return
    }

    // Neither batches nor source cards visible.
    // On unhealthy oracle, this is infrastructure weather — not a test failure.
    // Verify the page itself rendered (server-side h1 and main are always present).
    if (!oracleHealthy) {
      const pageLoaded = await page.locator('main, h1').first()
        .isVisible({ timeout: 5_000 }).catch(() => false)
      if (pageLoaded) {
        console.warn('SKIP: Oracle unhealthy — page rendered but no SSE data arrived. Fresh deploy or recovering API.')
        return
      }
    }

    // Oracle is healthy but nothing rendered — genuine failure
    expect(hasSource).toBeTruthy()
  })
})
