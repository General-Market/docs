/**
 * Vision E2E: Deposit + Bridge flow.
 *
 * Tests the full deposit lifecycle:
 * 1. Deposit L3 USDC to Vision balance via contract helper (simulates bridge)
 * 2. Verify balance bar appears on Vision page
 * 3. Test the BalanceDepositModal (L3 path) to deposit more
 * 4. Verify updated balance
 */
import { test, expect, TEST_ADDRESS } from '../fixtures/wallet'
import {
  PLAYER1,
  depositToVisionBalance,
  getVisionPlayerBalance,
  ensureBatchExists,
} from '../helpers/vision-api'

test.describe('Vision Deposit + Bridge', () => {
  test('deposit USDC to Vision balance and verify on UI', async ({ walletPage: page }) => {
    test.setTimeout(180_000)

    // 0. Ensure batches exist (Vision was deployed)
    await ensureBatchExists()

    // 1. Deposit 100 USDC to Vision balance via contract (simulates L3 bridge deposit)
    const depositAmount = BigInt(100) * BigInt(10 ** 18) // 100 USDC (18 dec on L3)
    await depositToVisionBalance(PLAYER1, depositAmount)

    // 2. Verify balance on-chain
    const balance = await getVisionPlayerBalance(PLAYER1)
    expect(balance).toBeGreaterThanOrEqual(depositAmount)

    // 3. Navigate to Vision page and connect wallet
    await page.goto('/')
    const connectBtn = page.getByRole('button', { name: /Connect Wallet|Log\s?In/ })
    if (await connectBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await connectBtn.click()
      await page.mouse.move(0, 0)
    }

    // 4. Wait for balance bar to appear (shows when total > 0)
    await expect(page.getByText(/Balance:.*USDC/)).toBeVisible({ timeout: 30_000 })

    // 5. Click DEPOSIT button on balance bar
    const depositBtn = page.getByRole('button', { name: 'DEPOSIT' })
    await expect(depositBtn).toBeVisible({ timeout: 10_000 })
    await depositBtn.click()

    // 6. BalanceDepositModal should open — "Deposit to Vision"
    await expect(page.getByText('Deposit to Vision')).toBeVisible({ timeout: 10_000 })

    // 7. Choose "From L3 Wallet" path
    await page.getByText('From L3 Wallet').click()

    // 8. Enter deposit amount (50 USDC)
    const amountInput = page.locator('input[placeholder="e.g., 100"]')
    await expect(amountInput).toBeVisible({ timeout: 10_000 })
    await amountInput.fill('50')

    // 9. Submit deposit
    const submitBtn = page.getByRole('button', { name: /Deposit from L3/ })
    await expect(submitBtn).toBeEnabled({ timeout: 15_000 })
    await submitBtn.click()

    // 10. Wait for success
    await expect(page.getByText('Deposit Successful')).toBeVisible({ timeout: 60_000 })

    // 11. Close modal
    const doneBtn = page.getByRole('button', { name: 'Done' })
    await doneBtn.click()

    // 12. Verify balance increased on-chain
    const newBalance = await getVisionPlayerBalance(PLAYER1)
    expect(newBalance).toBeGreaterThan(balance)
  })
})
