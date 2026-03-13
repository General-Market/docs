/**
 * Vision positions E2E — verifies Enter Batch validation and position display.
 *
 * Phase: ui-verify-vision
 * Uses visionTest fixture (VISION_PLAYER_KEY).
 *
 * NOTE: VISION_PLAYER is pre-funded with L3 USDC in globalSetup.
 * The depositToVisionBalance call here only sends VISION_PLAYER-signed txs
 * (approve + depositBalance), NOT deployer-signed minting — safe for Phase 2.
 */
import { visionTest as test, expect } from '../fixtures/wallet'
import { VISION_PLAYER_ADDRESS } from '../env'
import { ensureWalletConnected } from '../helpers/selectors'
import { depositToVisionBalance, getVisionPlayerBalance } from '../helpers/vision-api'
import { parseUnits } from 'viem'

test.describe('Vision Positions & Validation', () => {
  test('Enter Batch button requires predictions', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    await page.goto('/source/coingecko')
    await ensureWalletConnected(page, VISION_PLAYER_ADDRESS)

    const btn = page.getByRole('button', { name: /Enter Batch/ })
    await expect(btn).toBeVisible({ timeout: 30_000 })
    // Without any predictions set, button should be disabled
    await expect(btn).toBeDisabled()
  })

  test('balance bar shows after deposit', async ({ walletPage: page }) => {
    test.setTimeout(180_000)

    // Deposit 10 USDC to Vision balance.
    // ensureUsdcBalance inside will find pre-funded balance → no DEPLOYER mint needed.
    const depositAmount = parseUnits('10', 18)
    await depositToVisionBalance(VISION_PLAYER_ADDRESS, depositAmount)

    // Verify balance on-chain
    const balance = await getVisionPlayerBalance(VISION_PLAYER_ADDRESS)
    expect(balance).toBeGreaterThanOrEqual(depositAmount)

    // Check UI
    await page.goto('/')
    await ensureWalletConnected(page, VISION_PLAYER_ADDRESS)
    await expect(page.getByText(/Balance:.*USDC/i).first()).toBeVisible({ timeout: 60_000 })
  })
})
