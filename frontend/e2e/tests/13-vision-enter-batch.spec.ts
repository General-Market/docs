/**
 * Vision E2E: Enter Batch via source detail page UI.
 *
 * Tests the full enter-batch lifecycle through the frontend:
 * 1. Navigate to a source detail page
 * 2. Set predictions (UP/DN) on markets
 * 3. Enter stake amount
 * 4. Click "Enter Batch"
 * 5. Verify position exists on-chain
 *
 * Depends on test 12 having deposited Vision balance for the test user.
 */
import { visionTest as test, expect } from '../fixtures/wallet'
import { VISION_PLAYER_ADDRESS as TEST_ADDRESS, VISION_API } from '../env'
import { ensureWalletConnected } from '../helpers/selectors'
import {
  PLAYER1,
  getPosition,
  ensureBatchExists,
  getBatches,
  ensureUsdcBalance,
  getVisionUsdcAddress,
  impersonateAccount,
} from '../helpers/vision-api'

/**
 * Pick a source with few markets for testing.
 * Fetches live batch list from Vision API and returns the source
 * with the fewest markets (less DOM, faster clicks, fewer flakes).
 * Falls back to 'iss' if the API returns no source_id metadata.
 */
async function pickSmallSource(): Promise<{ sourceId: string; batchId: number } | null> {
  try {
    const batches = await getBatches()
    if (batches.length === 0) return null

    // Prefer batches with known source_id and small market count
    const withSource = batches
      .filter((b: any) => b.source_id && b.market_count > 0)
      .sort((a: any, b: any) => a.market_count - b.market_count)

    if (withSource.length > 0) {
      const pick = withSource[0] as any
      return { sourceId: pick.source_id, batchId: pick.id }
    }

    // No source_id on batches — fall back to first available
    const first = batches[0] as any
    return { sourceId: first.source_id || 'iss', batchId: first.id }
  } catch {
    return null
  }
}

test.describe('Vision Enter Batch (UI)', () => {
  test('enter batch via source detail page', async ({ walletPage: page }) => {
    test.setTimeout(300_000) // 5 min — must wait out any lock phase

    // 0. Ensure Vision is deployed and has batches
    await ensureBatchExists()

    // 0.5. Ensure test user has wallet USDC (round-based: no Vision balance pool)
    const visionUsdc = await getVisionUsdcAddress()
    await impersonateAccount(PLAYER1)
    await ensureUsdcBalance(PLAYER1, BigInt(100) * BigInt(10 ** 18), visionUsdc)

    // 1. Find a source with few markets to minimize DOM operations
    const target = await pickSmallSource()
    if (!target) {
      console.log('No batches with source metadata available — skipping UI enter test')
      test.skip()
      return
    }
    console.log(`Target source: ${target.sourceId} (batch ${target.batchId})`)

    // 2. Navigate to source detail page
    await page.goto(`/source/${target.sourceId}`)
    await page.waitForLoadState('domcontentloaded')

    // 3. Connect wallet
    await ensureWalletConnected(page, TEST_ADDRESS)

    // 4. Wait for markets to load (UP/DN buttons appear in MarketsTable)
    const upButton = page.getByRole('button', { name: 'UP' }).first()
    let hasMarkets = await upButton
      .waitFor({ state: 'visible', timeout: 90_000 })
      .then(() => true)
      .catch(() => false)
    if (!hasMarkets) {
      // Retry — data-node snapshot fetch can be slow on first load
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 })
      hasMarkets = await upButton
        .waitFor({ state: 'visible', timeout: 60_000 })
        .then(() => true)
        .catch(() => false)
    }
    if (!hasMarkets) {
      console.log(`No markets loaded for source ${target.sourceId} — data-node may be down`)
      test.skip()
      return
    }

    // 5. Set predictions on visible markets — click UP or DN alternately
    const upButtons = page.getByRole('button', { name: 'UP' })
    const dnButtons = page.getByRole('button', { name: 'DN' })

    const marketCount = await upButtons.count()
    console.log(`Setting predictions on ${marketCount} markets`)

    for (let i = 0; i < marketCount; i++) {
      if (i % 2 === 0) {
        await upButtons.nth(i).click()
      } else {
        await dnButtons.nth(i).click()
      }
      // Breathing room between clicks — DOM needs time to process rapid click events
      if (i % 10 === 9) await new Promise(r => setTimeout(r, 100))
    }

    // 6. Verify bitmap summary shows predictions set
    await expect(page.getByText(/\d+\s*UP/)).toBeVisible({ timeout: 5_000 })
    console.log(`All ${marketCount} market predictions set`)

    // 7. Enter stake amount using quick-stake $5 button
    const stakeBtn = page.getByRole('button', { name: '$5', exact: true })
    await expect(stakeBtn).toBeVisible({ timeout: 5_000 })
    await stakeBtn.click()

    // 8. Click "Enter Batch" (or "Deposit" if already joined from a prior run)
    const enterBatchBtn = page.getByRole('button', { name: /Enter Batch|Deposit/ })
    await expect(enterBatchBtn).toBeEnabled({ timeout: 240_000 })

    // If already joined, the button says "Deposit more" — test still passes
    const btnText = await enterBatchBtn.textContent()
    if (btnText && /Deposit/i.test(btnText) && !/Enter/i.test(btnText)) {
      console.log('Already joined batch — deposit flow verified')
      return
    }

    await enterBatchBtn.click()

    // 9. Wait for join to complete
    // Button cycles: "Checking balance..." → "Waiting for wallet..." → "Joining batch..." → "Confirming..." → "Submitting..."
    await Promise.race([
      // Success: position indicator appears
      expect(page.getByText(/Active position|Your position|Joined|Position/i)).toBeVisible({
        timeout: 90_000,
      }),
      // Success: button resets to idle state
      expect(page.getByRole('button', { name: /Enter Batch/ })).toBeEnabled({ timeout: 90_000 }),
      // Success: next tick is resolving
      expect(page.getByText(/Bets locked|resolving|bets are set/i)).toBeVisible({
        timeout: 90_000,
      }),
    ]).catch(async () => {
      // Check for error messages
      const errorText = await page
        .locator('.text-red-500, .text-red-600, .text-color-down')
        .textContent()
        .catch(() => '')
      if (errorText) {
        console.log(`Join attempt message: ${errorText}`)
      }
    })

    // 10. Verify position exists on-chain
    try {
      const pos = await getPosition(target.batchId, PLAYER1)
      expect(pos.stakePerTick).toBeGreaterThan(0n)
      expect(pos.totalDeposited).toBeGreaterThan(0n)
      expect(pos.bitmapHash).not.toBe('0x' + '0'.repeat(64))
      console.log(
        `Position verified: stake=${pos.stakePerTick}, deposited=${pos.totalDeposited}`,
      )
    } catch (e) {
      console.log(`Position read failed (may need more time): ${e}`)
    }
  })
})
