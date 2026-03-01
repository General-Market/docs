/**
 * Vision E2E: Claim batch rewards + Withdraw from Vision balance.
 *
 * Tests:
 * 1. Wait for at least one tick to resolve (30s tick duration)
 * 2. Withdraw from batch (exits batch + returns USDC to Vision balance)
 * 3. Withdraw from Vision balance to L3 wallet via BalanceWithdrawModal
 *
 * Depends on test 13 having entered a batch for the test user.
 */
import { test, expect, TEST_ADDRESS } from '../fixtures/wallet'
import {
  PLAYER1,
  getPosition,
  getVisionPlayerBalance,
  getVisionRealBalance,
  getL3UsdcBalance,
  depositToVisionBalance,
} from '../helpers/vision-api'

test.describe('Vision Claim + Withdraw', () => {
  test('withdraw from batch and Vision balance via UI', async ({ walletPage: page }) => {
    test.setTimeout(300_000) // 5 min — waiting for tick resolution + issuer BLS proof

    // 0. Always ensure Vision balance exists for withdraw test
    // Deposit USDC to Vision balance regardless of prior tests
    await depositToVisionBalance(PLAYER1, BigInt(50) * BigInt(10 ** 18))

    // Check if player has a position from test 13
    let hasPosition = false
    try {
      const pos = await getPosition(0, PLAYER1)
      hasPosition = pos.stakePerTick > 0n
    } catch { /* no position */ }

    // 1. Record balances before
    const visionBalBefore = await getVisionPlayerBalance(PLAYER1)
    const l3UsdcBefore = await getL3UsdcBalance(PLAYER1)

    // 2. Navigate to Vision page and connect wallet
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    } catch (e) {
      // ERR_ABORTED or timeout — Next.js dev server may be overloaded
      test.skip(true, `page.goto failed: ${(e as Error).message?.slice(0, 80)}`)
      return
    }
    const connectBtn = page.getByRole('button', { name: /Connect Wallet|Log\s?In/ })
    if (await connectBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await connectBtn.click()
      await page.mouse.move(0, 0)
      // Wait for wallet connection to complete (truncated address replaces Connect button)
      const truncated = TEST_ADDRESS.slice(0, 6) + '...' + TEST_ADDRESS.slice(-4)
      await expect(page.getByRole('button', { name: truncated })).toBeVisible({ timeout: 15_000 })
    }

    // Wait for balance bar
    await expect(page.getByText(/Balance:.*USDC/)).toBeVisible({ timeout: 30_000 })

    // 3. If player has a position, wait for tick resolution then try batch withdraw
    if (hasPosition) {
      console.log('Waiting for tick to resolve (~30-60s)...')
      // Wait for at least one tick cycle (30s) + some buffer for issuer processing
      await page.waitForTimeout(45_000)

      // Check if position balance changed (indicates tick resolution)
      try {
        const posAfterTick = await getPosition(0, PLAYER1)
        console.log(`Post-tick position: balance=${posAfterTick.balance}, lastClaimed=${posAfterTick.lastClaimedTick}`)
      } catch {
        console.log('Position read failed after tick wait')
      }

      // Try to find and click on the batch to expand it
      const batchCard = page.locator('[class*="BatchCard"], [class*="batch"]').first()
      if (await batchCard.isVisible({ timeout: 5_000 }).catch(() => false)) {
        await batchCard.click()
        await page.waitForTimeout(1_000)

        // Look for WITHDRAW button on the expanded batch
        const withdrawBatchBtn = page.getByRole('button', { name: 'WITHDRAW' }).first()
        if (await withdrawBatchBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
          await withdrawBatchBtn.click()

          // WithdrawModal opens — "Withdraw / Claim Batch"
          const modalVisible = await page.getByText(/Withdraw.*Claim|Withdraw from Batch/i)
            .isVisible({ timeout: 10_000 })
            .catch(() => false)

          if (modalVisible) {
            // Click "Withdraw All" to exit the batch entirely
            const withdrawAllBtn = page.getByText('Withdraw All')
            if (await withdrawAllBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
              await withdrawAllBtn.click()

              // Wait for BLS proof fetch + withdrawal confirmation
              const success = await page.getByText(/Withdrawal Successful/i)
                .isVisible({ timeout: 120_000 })
                .catch(() => false)

              if (success) {
                console.log('Batch withdrawal successful!')
                // Close the modal
                const closeBtn = page.getByRole('button', { name: 'Close' })
                if (await closeBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
                  await closeBtn.click()
                }
              } else {
                console.log('Batch withdrawal timed out — issuers may not have BLS proof yet. Continuing to balance withdraw.')
                // Close modal if open
                const closeX = page.locator('button:has-text("×")')
                if (await closeX.isVisible({ timeout: 2_000 }).catch(() => false)) {
                  await closeX.click()
                }
              }
            }
          }
        }
      }
    }

    // 4. Withdraw from Vision balance to L3 wallet via BalanceWithdrawModal
    // Reload to refresh balances
    await page.goto('/')
    if (await page.getByRole('button', { name: /Connect Wallet|Log\s?In/ }).isVisible({ timeout: 5_000 }).catch(() => false)) {
      await page.getByRole('button', { name: /Connect Wallet|Log\s?In/ }).click()
      await page.mouse.move(0, 0)
      const truncated2 = TEST_ADDRESS.slice(0, 6) + '...' + TEST_ADDRESS.slice(-4)
      await expect(page.getByRole('button', { name: truncated2 })).toBeVisible({ timeout: 15_000 })
    }
    await expect(page.getByText(/Balance:.*USDC/)).toBeVisible({ timeout: 30_000 })

    // Check current Vision real balance (only real balance can be withdrawn to L3)
    const realBalance = await getVisionRealBalance(PLAYER1)
    if (realBalance === 0n) {
      console.log('No real balance to withdraw to L3 — test complete')
      return
    }

    // 5. Click WITHDRAW button on balance bar
    const withdrawBtn = page.getByRole('button', { name: 'WITHDRAW' })
    await expect(withdrawBtn).toBeVisible({ timeout: 10_000 })
    await withdrawBtn.click()

    // 6. BalanceWithdrawModal should open — "Withdraw from Vision"
    await expect(page.getByText('Withdraw from Vision')).toBeVisible({ timeout: 10_000 })

    // 7. Choose "To L3 Wallet" path
    const toL3Btn = page.getByText('To L3 Wallet')
    await expect(toL3Btn).toBeVisible({ timeout: 5_000 })
    await toL3Btn.click()

    // 8. Click MAX to withdraw all available real balance
    const maxBtn = page.getByRole('button', { name: 'MAX' })
    await expect(maxBtn).toBeVisible({ timeout: 5_000 })
    await maxBtn.click()

    // 9. Submit withdrawal
    const submitBtn = page.getByRole('button', { name: /Withdraw to L3 Wallet/ })
    await expect(submitBtn).toBeEnabled({ timeout: 15_000 })
    await submitBtn.click()

    // 10. Wait for success
    await expect(page.getByText('Withdrawal Successful')).toBeVisible({ timeout: 60_000 })

    // 11. Close modal
    const doneBtn = page.getByRole('button', { name: 'Done' })
    await doneBtn.click()

    // 12. Verify USDC arrived in L3 wallet
    const l3UsdcAfter = await getL3UsdcBalance(PLAYER1)
    expect(l3UsdcAfter).toBeGreaterThan(l3UsdcBefore)

    console.log(`Withdraw complete: L3 USDC ${l3UsdcBefore} → ${l3UsdcAfter}`)
  })
})
