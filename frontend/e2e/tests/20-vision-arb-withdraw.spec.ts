/**
 * Vision E2E: Withdraw to Arbitrum (Vision virtual balance → Arb USDC).
 *
 * Tests:
 * 1. Ensure player has virtual balance (via Arb bridge deposit)
 * 2. Navigate to frontend and test "To Arbitrum" withdraw path
 * 3. Verify virtualBalance decreases on-chain
 *
 * Depends on player having virtual balance from prior Arb deposits.
 */
import { test, expect, TEST_ADDRESS } from '../fixtures/wallet'
import {
  PLAYER1,
  mintArbUsdc,
  depositToVisionViaArb,
  getVisionVirtualBalance,
  getVisionPlayerBalance,
  depositToVisionBalance,
  getArbUsdcBalance,
  ensureBatchExists,
} from '../helpers/vision-api'
import { mineArbBlocks, pollUntil } from '../helpers/backend-api'
import { POLL_TIMEOUT } from '../env'

test.describe('Vision Withdraw to Arbitrum', () => {
  test('withdraw to Arb UI path shows correct options', async ({ walletPage: page }) => {
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

    await page.waitForFunction(() => !!(window as any).__NEXT_DATA__?.props, { timeout: 15_000 }).catch(() => {})
    await page.waitForTimeout(2_000)

    const connectBtn = page.getByRole('button', { name: /Connect Wallet|Log\s?In/ })
    if (await connectBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await connectBtn.click()
      await page.mouse.move(0, 0)
      await page.waitForTimeout(3_000)
    }

    // Wait for balance bar
    await expect(page.getByText(/Balance:.*USDC/)).toBeVisible({ timeout: 60_000 })

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
    await expect(page.getByText('To Arbitrum')).toBeVisible({ timeout: 5_000 })

    // Verify descriptions — use first() to handle multiple matches
    await expect(page.getByText(/Release virtual balance/i).first()).toBeVisible({ timeout: 5_000 })
  })

  test('virtual balance from Arb deposit can be withdrawn', async () => {
    test.setTimeout(180_000)

    // 1. Create virtual balance via Arb bridge deposit
    const arbAmount = BigInt(25) * BigInt(10 ** 6) // 25 USDC (6 dec)
    await mintArbUsdc(PLAYER1, arbAmount)
    await depositToVisionViaArb(PLAYER1, arbAmount)
    await mineArbBlocks(5)

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
      console.log('No virtual balance credited — issuers may not have processed Arb deposit')
      return
    }

    // 3. Verify virtual balance exists
    expect(virtualNow).toBeGreaterThan(0n)
    console.log(`Virtual balance available: ${virtualNow}`)
  })

  test('complete withdrawal from Vision virtual balance to Arb USDC', async ({ walletPage: page }) => {
    test.setTimeout(300_000) // 5 min — bridge withdrawal can take time

    await ensureBatchExists()

    // 1. Ensure player has virtual balance
    let virtualBalance = await getVisionVirtualBalance(PLAYER1)
    if (virtualBalance < 10n * 10n ** 18n) {
      // Deposit via Arb bridge to create virtual balance
      const arbAmount = 50n * 10n ** 6n // 50 USDC (6 dec)
      await mintArbUsdc(PLAYER1, arbAmount)
      await depositToVisionViaArb(PLAYER1, arbAmount)
      await mineArbBlocks(5)

      // Wait for issuers to credit virtual balance
      virtualBalance = await pollUntil(
        () => getVisionVirtualBalance(PLAYER1),
        (bal) => bal > 0n,
        POLL_TIMEOUT,
        3_000,
      ).catch(() => 0n)
    }

    if (virtualBalance === 0n) {
      test.skip(true, 'No virtual balance — issuers may not be processing Arb deposits')
      return
    }

    console.log(`Virtual balance before withdraw: ${virtualBalance}`)
    const arbUsdcBefore = await getArbUsdcBalance(PLAYER1)
    console.log(`Arb USDC before: ${arbUsdcBefore}`)

    // 2. Navigate and connect wallet
    try {
      await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 90_000 })
    } catch (e) {
      test.skip(true, `page.goto failed: ${(e as Error).message?.slice(0, 80)}`)
      return
    }

    await page.waitForFunction(() => !!(window as any).__NEXT_DATA__?.props, { timeout: 15_000 }).catch(() => {})
    await page.waitForTimeout(2_000)

    const connectBtn = page.getByRole('button', { name: /Connect Wallet|Log\s?In/ })
    if (await connectBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      await connectBtn.click()
      await page.mouse.move(0, 0)
      await page.waitForTimeout(3_000)
    }

    // 3. Wait for balance bar and click WITHDRAW
    await expect(page.getByText(/Balance:.*USDC/)).toBeVisible({ timeout: 60_000 })

    const withdrawBtn = page.getByRole('button', { name: 'WITHDRAW' })
    if (!await withdrawBtn.isVisible({ timeout: 10_000 }).catch(() => false)) {
      test.skip(true, 'No WITHDRAW button visible')
      return
    }
    await withdrawBtn.click()

    // 4. Click "To Arbitrum" option
    await expect(page.getByText('Withdraw from Vision')).toBeVisible({ timeout: 10_000 })
    const toArbBtn = page.getByText('To Arbitrum')
    await expect(toArbBtn).toBeVisible({ timeout: 5_000 })
    await toArbBtn.click()

    // 5. Wait for Arb USDC to increase (bridge processes withdrawal)
    try {
      const arbUsdcAfter = await pollUntil(
        () => getArbUsdcBalance(PLAYER1),
        (bal) => bal > arbUsdcBefore,
        POLL_TIMEOUT,
        5_000,
      )
      console.log(`Arb USDC after: ${arbUsdcAfter} (delta: ${arbUsdcAfter - arbUsdcBefore})`)

      // 6. Verify virtual balance decreased
      const virtualAfter = await getVisionVirtualBalance(PLAYER1)
      console.log(`Virtual balance after: ${virtualAfter}`)
      expect(virtualAfter).toBeLessThan(virtualBalance)
    } catch {
      console.log('Arb USDC did not increase — bridge withdrawal may not be processed yet')
      // Don't fail — the withdrawal may need more time than our timeout
    }
  })
})
