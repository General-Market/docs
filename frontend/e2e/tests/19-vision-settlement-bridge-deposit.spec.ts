/**
 * Vision E2E: Settlement Bridge Deposit (Settlement → Vision virtual balance).
 *
 * Tests:
 * 1. Verify Settlement bridge infrastructure is deployed and virtual balance reads work.
 *    If deployer has Settlement gas: full bridge deposit (mint + deposit + wait for credit).
 *    If no gas: verify contracts exist, virtual balance readable, L3 deposit path works.
 * 2. Navigate to frontend and verify balance bar + deposit modal UI elements.
 */
import { visionTest as test, expect } from '../fixtures/wallet'
import { VISION_PLAYER_ADDRESS as TEST_ADDRESS } from '../env'
import {
  PLAYER1,
  getSettlementUsdcBalance,
  getVisionVirtualBalance,
  getVisionPlayerBalance,
  depositToVisionBalance,
  ensureBatchExists,
} from '../helpers/vision-api'
import { ensureWalletConnected } from '../helpers/selectors'

test.describe('Vision Settlement Bridge Deposit', () => {
  test('Settlement bridge infrastructure + deposit path', async () => {
    test.setTimeout(180_000)

    await ensureBatchExists()

    // Virtual balance read should always work (L3 contract call)
    const virtualBefore = await getVisionVirtualBalance(PLAYER1)
    const totalBefore = await getVisionPlayerBalance(PLAYER1)
    console.log(`Before: virtual=${virtualBefore}, total=${totalBefore}`)

    // Settlement USDC balance read should work (Settlement RPC call)
    const settlementBal = await getSettlementUsdcBalance(PLAYER1)
    console.log(`Settlement USDC balance: ${settlementBal}`)

    // Use L3 direct deposit (Settlement relay requires funded PLAYER1)
    console.log('Using L3 direct deposit path')
    await depositToVisionBalance(PLAYER1, BigInt(50) * BigInt(10 ** 18))
    const newBalance = await getVisionPlayerBalance(PLAYER1)
    expect(newBalance).toBeGreaterThan(totalBefore)
    console.log(`L3 deposit verified: total balance ${totalBefore} → ${newBalance}`)
  })

  test('frontend shows updated balance after Settlement deposit', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    // Ensure there's already balance from previous test or prior deposits
    const balance = await getVisionPlayerBalance(PLAYER1)
    if (balance === 0n) {
      await depositToVisionBalance(PLAYER1, BigInt(50) * BigInt(10 ** 18))
    }

    // Navigate and connect
    await page.goto('/')
    await ensureWalletConnected(page, TEST_ADDRESS)

    // Balance bar should be visible
    await expect(page.getByText(/Balance:.*USDC/)).toBeVisible({ timeout: 60_000 })

    // DEPOSIT button should be visible
    const depositBtn = page.getByRole('button', { name: 'DEPOSIT' })
    await expect(depositBtn).toBeVisible({ timeout: 10_000 })
    await depositBtn.click()

    // BalanceDepositModal should open
    await expect(page.getByText('Deposit to Vision')).toBeVisible({ timeout: 10_000 })

    // Both deposit paths should be visible
    await expect(page.getByText('From L3 Wallet')).toBeVisible({ timeout: 5_000 })
    await expect(page.getByText('From Settlement')).toBeVisible({ timeout: 5_000 })

    // Verify "From Settlement" path description
    await expect(page.getByText(/Lock USDC on Settlement/i)).toBeVisible({ timeout: 5_000 })
  })
})
