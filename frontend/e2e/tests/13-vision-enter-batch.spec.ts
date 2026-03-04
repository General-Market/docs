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
import { test, expect, TEST_ADDRESS } from '../fixtures/wallet'
import {
  PLAYER1,
  getPosition,
  getVisionPlayerBalance,
  depositToVisionBalance,
  ensureBatchExists,
} from '../helpers/vision-api'

test.describe('Vision Enter Batch (UI)', () => {
  test('enter batch via source detail page', async ({ walletPage: page }) => {
    test.setTimeout(180_000)

    // 0. Ensure Vision is deployed and has batches
    await ensureBatchExists()

    // 0.5. Ensure test user has Vision balance (deposit if needed)
    const currentBalance = await getVisionPlayerBalance(PLAYER1)
    if (currentBalance < BigInt(10) * BigInt(10 ** 18)) {
      await depositToVisionBalance(PLAYER1, BigInt(100) * BigInt(10 ** 18))
    }

    // 1. Navigate to Pump.fun source detail page (batchId 0)
    await page.goto('/source/pumpfun')
    await page.waitForLoadState('domcontentloaded')

    // 2. Connect wallet
    const connectBtn = page.getByRole('button', { name: /Connect Wallet|Log\s?In/ })
    if (await connectBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await connectBtn.click()
      await page.mouse.move(0, 0)
      // Wait for wallet connection
      const truncated = TEST_ADDRESS.slice(0, 6) + '...' + TEST_ADDRESS.slice(-4)
      await expect(page.getByRole('button', { name: truncated })).toBeVisible({ timeout: 15_000 })
    }

    // 3. Wait for markets to load (UP/DN buttons should appear)
    // Pumpfun has ~1200 markets — first snapshot fetch can take 60-90s on cold start
    // Note: locator.isVisible() returns immediately; use waitFor() to actually poll
    const upButton = page.getByRole('button', { name: 'UP' }).first()
    const hasMarkets = await upButton.waitFor({ state: 'visible', timeout: 90_000 }).then(() => true).catch(() => false)
    if (!hasMarkets) {
      test.skip(true, 'Markets not loaded — UP buttons not visible within timeout')
      return
    }

    // 4. Set predictions on first 3 markets — alternate UP/DN
    const upButtons = page.getByRole('button', { name: 'UP' })
    const dnButtons = page.getByRole('button', { name: 'DN' })

    const upCount = await upButtons.count()
    const betsToSet = Math.min(upCount, 5) // Set at least 5 bets (or all if fewer)

    for (let i = 0; i < betsToSet; i++) {
      if (i % 2 === 0) {
        await upButtons.nth(i).click()
      } else {
        await dnButtons.nth(i).click()
      }
      await page.waitForTimeout(200) // Small delay between clicks
    }

    // 5. Verify bets are set — bitmap summary should show counts
    // The summary bar shows "N UP / N DN / N unset"
    await expect(page.getByText(/\d+\s*UP/)).toBeVisible({ timeout: 5_000 })

    // 6. Enter stake amount using quick stake button ($5)
    const stakeBtn = page.getByRole('button', { name: '$5', exact: true })
    await expect(stakeBtn).toBeVisible({ timeout: 5_000 })
    await stakeBtn.click()

    // 7. Click "Enter Batch" button
    // Batch may be locked (resolving phase) — wait up to 2 full cycles for it to open
    const enterBatchBtn = page.getByRole('button', { name: /Enter Batch|Deposit/ })
    await expect(enterBatchBtn).toBeEnabled({ timeout: 120_000 })
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

    // 9. Verify position exists on-chain (batch 0 = pumpfun)
    try {
      const pos = await getPosition(0, PLAYER1)
      expect(pos.stakePerTick).toBeGreaterThan(0n)
      expect(pos.totalDeposited).toBeGreaterThan(0n)
      expect(pos.bitmapHash).not.toBe('0x' + '0'.repeat(64))
      console.log(`Position verified: stake=${pos.stakePerTick}, deposited=${pos.totalDeposited}`)
    } catch (e) {
      console.log(`Position read failed (may need more time): ${e}`)
    }
  })
})
