/**
 * Faucet E2E — tests the /api/faucet endpoint and the
 * "Mint Test USDC" button in BalanceDepositModal.
 *
 * Phase: ui-verify-vision
 * Uses visionTest fixture for UI tests (separate key from itp tests).
 * API-only tests use @playwright/test (no wallet).
 */
import { test as plainTest, expect as plainExpect } from '@playwright/test'
import { visionTest as test, expect } from '../fixtures/wallet'
import { FRONTEND_URL, IS_ANVIL, VISION_PLAYER_ADDRESS } from '../env'
import { ensureWalletConnected } from '../helpers/selectors'

const BASE = FRONTEND_URL

async function apiPost(path: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: 'POST',
    signal: AbortSignal.timeout(30_000),
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(body),
  })
}

plainTest.describe('Faucet API', () => {
  plainTest('POST /api/faucet rejects invalid address', async () => {
    const res = await apiPost('/api/faucet', { address: 'bad' })
    plainExpect(res.status).toBe(400)
    const data = await res.json()
    plainExpect(data.error).toContain('Invalid address')
  })

  plainTest('POST /api/faucet caps at 10,000 USDC', async () => {
    const testAddr = IS_ANVIL
      ? '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'
      : VISION_PLAYER_ADDRESS
    const res = await apiPost('/api/faucet', {
      address: testAddr,
      amount: '999999',
    })
    // Faucet should either succeed with capped amount or return an error
    if (res.ok) {
      const data = await res.json()
      // API returns { usdc: { amount: "10000 USDC" } } or legacy { amount: "10000 USDC" }
      const usdcAmount = data.usdc?.amount ?? data.amount
      plainExpect(usdcAmount).toBe('10000 USDC')
    } else {
      // On testnet, faucet may reject large amounts — just verify it responded
      plainExpect(res.status).toBeLessThan(500)
    }
  })
})

test.describe('Faucet UI', () => {
  test('BalanceDepositModal shows Mint Test USDC button', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    await ensureWalletConnected(page, VISION_PLAYER_ADDRESS)

    const depositBtn = page.getByRole('button', { name: 'DEPOSIT' })
    await expect(depositBtn).toBeVisible({ timeout: 30_000 })
    await depositBtn.click()

    await expect(page.getByText('Deposit to Vision')).toBeVisible({ timeout: 10_000 })
    const mintBtn = page.getByText('Mint Test USDC')
    await expect(mintBtn).toBeVisible({ timeout: 10_000 })

    await mintBtn.click()
    await expect(page.getByText(/1,000 USDC minted/i)).toBeVisible({ timeout: 30_000 })
  })
})
