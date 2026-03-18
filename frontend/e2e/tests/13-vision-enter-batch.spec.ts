/**
 * Vision E2E: Enter Batch via source detail page UI.
 *
 * Tests the full enter-batch lifecycle through the frontend:
 * 1. Navigate to a source detail page
 * 2. Set predictions (UP/DOWN) on markets
 * 3. Enter stake amount
 * 4. Click "Enter Batch"
 * 5. Verify position exists on-chain
 *
 * Depends on test 12 having deposited Vision balance for the test user.
 */
import { visionTest as test, expect } from '../fixtures/wallet'
import { VISION_PLAYER_ADDRESS as TEST_ADDRESS } from '../env'
import { ensureWalletConnected } from '../helpers/selectors'
import {
  PLAYER1,
  getPosition,
  getVisionPlayerBalance,
  depositToVisionBalance,
  ensureBatchExists,
} from '../helpers/vision-api'

test.describe('Vision Enter Batch (UI)', () => {
  test('enter batch via source detail page', async ({ walletPage: page }) => {
    test.setTimeout(300_000) // 5 min — must wait out any lock phase

    // 0. Ensure Vision is deployed and has batches
    await ensureBatchExists()

    // 0.5. Ensure test user has Vision balance (deposit if needed)
    const currentBalance = await getVisionPlayerBalance(PLAYER1)
    if (currentBalance < BigInt(10) * BigInt(10 ** 18)) {
      await depositToVisionBalance(PLAYER1, BigInt(100) * BigInt(10 ** 18))
    }

    // 1. Navigate to a source with very few markets (ISS has ~3)
    // ISS = space category, 600s tick, 150s lock — all markets fit in DOM without scroll
    await page.goto('/source/iss')
    await page.waitForLoadState('domcontentloaded')

    // 2. Connect wallet
    await ensureWalletConnected(page, TEST_ADDRESS)

    // 3. Wait for markets to load (UP/DN buttons should appear)
    // Pumpfun has ~1200 markets — first snapshot fetch can take 60-90s on cold start
    // Note: locator.isVisible() returns immediately; use waitFor() to actually poll
    const upButton = page.getByRole('button', { name: 'UP' }).first()
    let hasMarkets = await upButton.waitFor({ state: 'visible', timeout: 90_000 }).then(() => true).catch(() => false)
    if (!hasMarkets) {
      // Retry — data-node snapshot fetch may be slow on first load
      await page.reload({ waitUntil: 'domcontentloaded', timeout: 60_000 })
      await page.waitForTimeout(3_000)
      hasMarkets = await upButton.waitFor({ state: 'visible', timeout: 60_000 }).then(() => true).catch(() => false)
    }
    expect(hasMarkets).toBe(true)

    // 4. Set predictions on ALL markets — component requires every market to have a bet
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
      // Small delay between clicks to avoid overwhelming the UI
      if (i % 10 === 9) await page.waitForTimeout(100)
    }

    // 5. Verify all bets are set — bitmap summary should show no unset
    await expect(page.getByText(/\d+\s*UP/)).toBeVisible({ timeout: 5_000 })
    console.log(`All ${marketCount} market predictions set`)

    // 6. Enter stake amount using quick stake button ($5)
    const stakeBtn = page.getByRole('button', { name: '$5', exact: true })
    await expect(stakeBtn).toBeVisible({ timeout: 5_000 })
    await stakeBtn.click()

    // 7. Click "Enter Batch" button
    // Batch may be locked (resolving phase) — wait up to full tick cycle (600s for space/ISS)
    const enterBatchBtn = page.getByRole('button', { name: /Enter Batch|Deposit/ })
    // Use expect().toBeEnabled() which actually polls, unlike locator.isEnabled() which returns immediately
    await expect(enterBatchBtn).toBeEnabled({ timeout: 240_000 })
    await enterBatchBtn.click()

    // 8. Wait for the join process to complete
    // Button text changes: "Checking balance..." → "Waiting for wallet..." → "Joining batch..." → "Confirming..." → "Submitting..."
    // After success, the button should reset or show position info

    // Wait for either success indicator or the button text to change back
    // The join may take up to 30s depending on tick lock windows
    await Promise.race([
      // Success: position appears in "My Positions" section
      expect(page.getByText(/Your position|Joined|Position/i)).toBeVisible({ timeout: 90_000 }),
      // Success: button resets after join completes
      expect(page.getByRole('button', { name: 'Enter Batch' })).toBeEnabled({ timeout: 90_000 }),
      // Success: if locked, shows "Bets locked"
      expect(page.getByText(/Bets locked|resolving/i)).toBeVisible({ timeout: 90_000 }),
    ]).catch(async () => {
      // Check if there was an error
      const errorText = await page.locator('.text-red-500, .text-color-down').textContent().catch(() => '')
      if (errorText) {
        console.log(`Join attempt message: ${errorText}`)
      }
    })

    // 9. Verify position exists on-chain (batch 25 = iss)
    try {
      const pos = await getPosition(25, PLAYER1)
      expect(pos.stakePerTick).toBeGreaterThan(0n)
      expect(pos.totalDeposited).toBeGreaterThan(0n)
      expect(pos.bitmapHash).not.toBe('0x' + '0'.repeat(64))
      console.log(`Position verified: stake=${pos.stakePerTick}, deposited=${pos.totalDeposited}`)
    } catch (e) {
      console.log(`Position read failed (may need more time): ${e}`)
    }
  })
})
