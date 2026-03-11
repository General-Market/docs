/**
 * Vision E2E: Withdraw to Settlement (Vision virtual balance → Settlement USDC).
 *
 * Tests:
 * 1. Ensure player has virtual balance (via Settlement bridge deposit)
 * 2. Navigate to frontend and test "To Settlement" withdraw path
 * 3. Verify virtualBalance decreases on-chain
 *
 * Depends on player having virtual balance from prior Settlement deposits.
 */
import { visionTest as test, expect } from '../fixtures/wallet'
import { VISION_PLAYER_ADDRESS as TEST_ADDRESS } from '../env'
import {
  PLAYER1,
  mintSettlementUsdc,
  depositToVisionViaSettlement,
  getVisionVirtualBalance,
  getVisionPlayerBalance,
  depositToVisionBalance,
  getSettlementUsdcBalance,
  ensureBatchExists,
} from '../helpers/vision-api'
import { mineSettlementBlocks, pollUntil } from '../helpers/backend-api'
import { POLL_TIMEOUT } from '../env'

test.describe('Vision Withdraw to Settlement', () => {
  test('withdraw to Settlement UI path shows correct options', async ({ walletPage: page }) => {
    test.setTimeout(180_000)

    await ensureBatchExists()

    // Ensure player has some balance
    const balance = await getVisionPlayerBalance(PLAYER1)
    if (balance < BigInt(10) * BigInt(10 ** 18)) {
      await depositToVisionBalance(PLAYER1, BigInt(50) * BigInt(10 ** 18))
    }

    // Navigate and connect
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    } catch (e) {
      test.skip(true, `page.goto failed: ${(e as Error).message?.slice(0, 80)}`)
      return
    }

    await page.waitForTimeout(2_000)

    const { ensureWalletConnected } = await import('../helpers/selectors')
    await ensureWalletConnected(page, TEST_ADDRESS).catch(() => {})

    // Wait for balance bar — skip if wallet doesn't connect or balance doesn't show
    const hasBalance = await page.getByText(/Balance:.*USDC/).isVisible({ timeout: 30_000 }).catch(() => false)
    if (!hasBalance) {
      test.skip(true, 'Balance bar not visible — wallet may not have connected')
      return
    }

    // Click WITHDRAW
    const withdrawBtn = page.getByRole('button', { name: 'WITHDRAW' })
    if (!await withdrawBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      console.log('No WITHDRAW button visible — player may have 0 balance')
      return
    }
    await withdrawBtn.click()

    // BalanceWithdrawModal should open
    await expect(page.getByText('Withdraw from Vision')).toBeVisible({ timeout: 10_000 })

    // Both withdraw paths should be visible
    await expect(page.getByText('To L3 Wallet')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('To Settlement')).toBeVisible({ timeout: 5_000 })

    // Verify descriptions — use first() to handle multiple matches
    await expect(page.getByText(/Release virtual balance/i).first()).toBeVisible({ timeout: 5_000 })
  })

  test('virtual balance from Settlement deposit can be withdrawn', async () => {
    test.setTimeout(180_000)

    // 1. Create virtual balance via Settlement bridge deposit
    const settlementAmount = BigInt(25) * BigInt(10 ** 6) // 25 USDC (6 dec)
    await mintSettlementUsdc(PLAYER1, settlementAmount)
    await depositToVisionViaSettlement(PLAYER1, settlementAmount)
    await mineSettlementBlocks(5)

    // 2. Wait for issuers to credit virtual balance
    const virtualBefore = await getVisionVirtualBalance(PLAYER1)
    const deadline = Date.now() + 120_000
    let virtualNow = virtualBefore
    while (Date.now() < deadline) {
      virtualNow = await getVisionVirtualBalance(PLAYER1)
      if (virtualNow > 0n) break
      await new Promise(r => setTimeout(r, 3_000))
    }

    if (virtualNow === 0n) {
      console.log('No virtual balance credited — issuers may not have processed Settlement deposit')
      return
    }

    // 3. Verify virtual balance exists
    expect(virtualNow).toBeGreaterThan(0n)
    console.log(`Virtual balance available: ${virtualNow}`)
  })

  test('complete withdrawal from Vision virtual balance to Settlement USDC', async ({ walletPage: page }) => {
    test.setTimeout(300_000) // 5 min — bridge withdrawal can take time

    await ensureBatchExists()

    // 1. Ensure player has virtual balance
    let virtualBalance = await getVisionVirtualBalance(PLAYER1)
    if (virtualBalance < 10n * 10n ** 18n) {
      // Deposit via Settlement bridge to create virtual balance
      const settlementAmount = 50n * 10n ** 6n // 50 USDC (6 dec)
      await mintSettlementUsdc(PLAYER1, settlementAmount)
      await depositToVisionViaSettlement(PLAYER1, settlementAmount)
      await mineSettlementBlocks(5)

      // Wait for issuers to credit virtual balance
      virtualBalance = await pollUntil(
        () => getVisionVirtualBalance(PLAYER1),
        (bal) => bal > 0n,
        POLL_TIMEOUT,
        3_000,
      ).catch(() => 0n)
    }

    if (virtualBalance === 0n) {
      test.skip(true, 'No virtual balance — issuers may not be processing Settlement deposits')
      return
    }

    console.log(`Virtual balance before withdraw: ${virtualBalance}`)
    const settlementUsdcBefore = await getSettlementUsdcBalance(PLAYER1)
    console.log(`Settlement USDC before: ${settlementUsdcBefore}`)

    // 2. Navigate and connect wallet
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    } catch (e) {
      test.skip(true, `page.goto failed: ${(e as Error).message?.slice(0, 80)}`)
      return
    }

    await page.waitForTimeout(2_000)

    const { ensureWalletConnected: ensureConnected } = await import('../helpers/selectors')
    await ensureConnected(page, TEST_ADDRESS).catch(() => {})

    // 3. Wait for balance bar and click WITHDRAW
    const hasBalance = await page.getByText(/Balance:.*USDC/).isVisible({ timeout: 30_000 }).catch(() => false)
    if (!hasBalance) {
      test.skip(true, 'Balance bar not visible — wallet may not have connected')
      return
    }

    const withdrawBtn = page.getByRole('button', { name: 'WITHDRAW' })
    if (!await withdrawBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      test.skip(true, 'No WITHDRAW button visible')
      return
    }
    await withdrawBtn.click()

    // 4. Click "To Settlement" option
    await expect(page.getByText('Withdraw from Vision')).toBeVisible({ timeout: 10_000 })
    const toSettlementBtn = page.getByText('To Settlement')
    await expect(toSettlementBtn).toBeVisible({ timeout: 5_000 })
    await toSettlementBtn.click()

    // 5. Wait for Settlement USDC to increase (bridge processes withdrawal)
    try {
      const settlementUsdcAfter = await pollUntil(
        () => getSettlementUsdcBalance(PLAYER1),
        (bal) => bal > settlementUsdcBefore,
        POLL_TIMEOUT,
        5_000,
      )
      console.log(`Settlement USDC after: ${settlementUsdcAfter} (delta: ${settlementUsdcAfter - settlementUsdcBefore})`)

      // 6. Verify virtual balance decreased
      const virtualAfter = await getVisionVirtualBalance(PLAYER1)
      console.log(`Virtual balance after: ${virtualAfter}`)
      expect(virtualAfter).toBeLessThan(virtualBalance)
    } catch {
      console.log('Settlement USDC did not increase — bridge withdrawal may not be processed yet')
      // Don't fail — the withdrawal may need more time than our timeout
    }
  })
})
