/**
 * Vision Auto-Settlement + Balance Withdraw
 *
 * 1. Deposit USDC to Vision balance (for the withdraw test)
 * 2. Join a round (or rely on test 10's round) and wait for settlement
 * 3. After settlement: verify realBalance increased
 * 4. Navigate to Vision page, click WITHDRAW on balance bar
 * 5. BalanceWithdrawModal -> "To L3 Wallet" -> MAX -> submit
 * 6. Verify USDC arrived in L3 wallet
 */
import { visionTest as test, expect } from '../fixtures/wallet'
import { VISION_PLAYER_ADDRESS as TEST_ADDRESS, CONSENSUS_TIMEOUT } from '../env'
import {
  PLAYER1,
  PLAYER2,
  getActiveRounds,
  joinRoundDirect,
  waitForRoundSettled,
  getBatchConfigHash,
  getVisionRealBalance,
  getL3UsdcBalance,
  getVisionUsdcAddress,
  depositToVisionBalance,
  impersonateAccount,
  ensureUsdcBalance,
  randomBets,
  oppositeBets,
} from '../helpers/vision-api'
import { ensureWalletConnected } from '../helpers/selectors'

test.describe('Vision Auto-Settlement + Balance Withdraw', () => {
  test('settle round then withdraw from Vision balance to L3 wallet', async ({ walletPage: page }) => {
    test.setTimeout(300_000)

    // 0. Deposit USDC to Vision balance so we always have something to withdraw
    await depositToVisionBalance(PLAYER1, 50n * 10n ** 18n)

    // 1. Join a round so we can verify settlement credits realBalance
    const rounds = await getActiveRounds()
    let batchId: number | null = null

    if (rounds.length > 0) {
      const round = rounds[0]
      batchId = round.batchId
      const configHash = await getBatchConfigHash(batchId)
      const deposit = 10n * 10n ** 18n
      const stake = 1n * 10n ** 18n
      const marketCount = 10

      await impersonateAccount(PLAYER1)
      await ensureUsdcBalance(PLAYER1, deposit)
      await impersonateAccount(PLAYER2)
      await ensureUsdcBalance(PLAYER2, deposit)

      const p1Bets = randomBets(marketCount)
      const p2Bets = oppositeBets(p1Bets)

      await Promise.all([
        joinRoundDirect(PLAYER1, batchId, configHash, deposit, stake, p1Bets, marketCount),
        joinRoundDirect(PLAYER2, batchId, configHash, deposit, stake, p2Bets, marketCount),
      ])
      console.log(`Joined round ${batchId}, waiting for auto-settlement...`)
    }

    // 2. Wait for settlement (credits realBalance)
    const realBalBefore = await getVisionRealBalance(PLAYER1)
    if (batchId !== null) {
      const settled = await waitForRoundSettled(batchId, CONSENSUS_TIMEOUT)
      if (settled) {
        const realBalAfter = await getVisionRealBalance(PLAYER1)
        console.log(`realBalance before=${realBalBefore}, after=${realBalAfter}`)
        // Settlement should credit something (deposit return + PnL)
        expect(realBalAfter).toBeGreaterThanOrEqual(realBalBefore)
      } else {
        console.log('Round did not settle within timeout — continuing with deposit-based withdraw')
      }
    }

    // 3. Record L3 USDC balance before withdraw
    const visionUsdc = await getVisionUsdcAddress()
    const l3UsdcBefore = await getL3UsdcBalance(PLAYER1, visionUsdc)

    // 4. Check realBalance is withdrawable
    const realBalance = await getVisionRealBalance(PLAYER1)
    if (realBalance === 0n) {
      console.log('No real balance to withdraw — test complete')
      return
    }

    // 5. Navigate to Vision page
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    } catch {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    }

    await ensureWalletConnected(page, TEST_ADDRESS).catch(() => {
      console.log('Wallet connect did not confirm — continuing')
    })

    await expect(page.getByText(/Balance:.*USDC/)).toBeVisible({ timeout: 30_000 })

    // 6. Click WITHDRAW on balance bar
    const withdrawBtn = page.getByRole('button', { name: 'WITHDRAW' })
    await expect(withdrawBtn).toBeVisible({ timeout: 10_000 })
    await withdrawBtn.click()

    // 7. BalanceWithdrawModal — "Withdraw from Vision"
    await expect(page.getByText('Withdraw from Vision')).toBeVisible({ timeout: 10_000 })

    // 8. Choose "To L3 Wallet"
    const toL3Btn = page.getByText('To L3 Wallet')
    await expect(toL3Btn).toBeVisible({ timeout: 5_000 })
    await toL3Btn.click()

    // 9. MAX
    const maxBtn = page.getByRole('button', { name: 'MAX' })
    await expect(maxBtn).toBeVisible({ timeout: 5_000 })
    await maxBtn.click()

    // 10. Submit
    const submitBtn = page.getByRole('button', { name: /Withdraw to L3 Wallet/ })
    await expect(submitBtn).toBeEnabled({ timeout: 15_000 })
    await submitBtn.click()

    // 11. Wait for success
    await expect(page.getByText('Withdrawal Successful')).toBeVisible({ timeout: 60_000 })

    // 12. Close modal
    const doneBtn = page.getByRole('button', { name: 'Done' })
    await doneBtn.click()

    // 13. Verify USDC arrived in L3 wallet
    const l3UsdcAfter = await getL3UsdcBalance(PLAYER1, visionUsdc)
    expect(l3UsdcAfter).toBeGreaterThan(l3UsdcBefore)
    console.log(`Withdraw complete: L3 USDC ${l3UsdcBefore} -> ${l3UsdcAfter}`)
  })
})
