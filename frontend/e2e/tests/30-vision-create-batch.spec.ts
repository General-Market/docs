/**
 * Vision Create Batch E2E — tests the full 4-step batch creation wizard.
 * Phase: write-after (creates batch on-chain)
 */
import { visionTest as test, expect } from '../fixtures/wallet'
import { VISION_PLAYER_ADDRESS } from '../env'
import { ensureWalletConnected } from '../helpers/selectors'

test.describe('Vision Create Batch', () => {
  test('Create Batch button opens modal with Step 1', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    await page.goto('/')
    await ensureWalletConnected(page, VISION_PLAYER_ADDRESS)

    const createBtn = page.getByRole('button', { name: /Create Batch/i })
    await expect(createBtn).toBeVisible({ timeout: 15_000 })
    await createBtn.click()

    // Modal opens with Markets step
    await expect(page.getByText(/Select Markets|Create Batch/i).first()).toBeVisible({ timeout: 10_000 })
  })

  test('Create Batch wizard navigates all 4 steps and submits', async ({ walletPage: page }) => {
    test.setTimeout(300_000)

    await page.goto('/')
    await ensureWalletConnected(page, VISION_PLAYER_ADDRESS)

    // Step 1: Open wizard
    const createBtn = page.getByRole('button', { name: /Create Batch/i })
    await expect(createBtn).toBeVisible({ timeout: 15_000 })
    await createBtn.click()
    await expect(page.getByText(/Select Markets/i).first()).toBeVisible({ timeout: 10_000 })

    // Step 1: Select markets
    const searchInput = page.locator('input[placeholder*="Search"]').first()
    const hasSearch = await searchInput.isVisible({ timeout: 5_000 }).catch(() => false)
    if (hasSearch) {
      await searchInput.fill('bitcoin')
      await page.waitForTimeout(1_000)
    }

    // Click first available market checkbox/row
    const marketItem = page.locator('[data-testid="market-row"], tr, label').filter({ hasText: /BTC|bitcoin/i }).first()
    const hasMarket = await marketItem.isVisible({ timeout: 5_000 }).catch(() => false)
    if (hasMarket) {
      await marketItem.click()
    }

    // Step 2: Configure
    const nextBtn = page.getByRole('button', { name: /Next|Continue/i }).first()
    await expect(nextBtn).toBeVisible({ timeout: 10_000 })
    await nextBtn.click()
    await expect(page.getByText(/Configure|Resolution|Tick/i).first()).toBeVisible({ timeout: 10_000 })

    const durationBtn = page.getByRole('button', { name: /5 min|10 min|30 min/i }).first()
    const hasDuration = await durationBtn.isVisible({ timeout: 5_000 }).catch(() => false)
    if (hasDuration) await durationBtn.click()

    // Step 3: Preview
    await nextBtn.click()
    await expect(page.getByText(/Preview|Summary|Review/i).first()).toBeVisible({ timeout: 10_000 })

    // Step 4: Submit on-chain
    const confirmBtn = page.getByRole('button', { name: /Confirm|Create|Submit/i }).first()
    await expect(confirmBtn).toBeVisible({ timeout: 10_000 })
    await confirmBtn.click()

    // Wait for on-chain confirmation
    await expect(page.getByText(/Batch Created|Transaction|Success/i).first()).toBeVisible({ timeout: 180_000 })
  })
})
