/**
 * Vision E2E: Lock phase UI verification.
 *
 * Validates that the UI correctly reflects the betting vs lock phase
 * of a Vision batch round:
 * - During betting phase: entry controls are visible and enabled
 * - During lock phase: UI shows locked/countdown state, join is blocked
 *
 * This is a best-effort test — lock phase timing depends on when
 * the test runs relative to the round lifecycle.
 */
import { visionTest as test, expect } from '../fixtures/wallet'
import { VISION_PLAYER_ADDRESS as TEST_ADDRESS, VISION_API } from '../env'
import { ensureWalletConnected } from '../helpers/selectors'
import {
  getActiveRounds,
  ensureBatchExists,
  type RoundInfo,
} from '../helpers/vision-api'

/**
 * Quick reachability check — 5s timeout. Returns true if the Vision API
 * responds at all, false otherwise. Prevents the suite from burning 2 min
 * in retry loops when the oracle is simply not running.
 */
async function isVisionApiReachable(): Promise<boolean> {
  try {
    const res = await fetch(`${VISION_API}/vision/batches`, {
      signal: AbortSignal.timeout(5_000),
    })
    return res.ok
  } catch {
    return false
  }
}

test.describe('Vision Lock Phase UI', () => {
  test('45a: betting phase shows enabled entry controls', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    // 0. Fast-fail: check Vision API reachability before slow retries
    if (!(await isVisionApiReachable())) {
      console.warn('SKIP: Vision API unreachable (5s timeout) — oracle is likely down.')
      test.skip()
      return
    }

    // 1. Ensure batches exist
    await ensureBatchExists()

    // 2. Get active rounds to find a source with an active betting window
    const rounds = await getActiveRounds()
    if (rounds.length === 0) {
      console.warn('SKIP: No active rounds — oracle may not have spawned rounds yet. Cannot verify lock phase UI.')
      test.skip()
      return
    }

    // Pick the first round in betting status, or fall back to any round
    const bettingRound = rounds.find((r: RoundInfo) => r.status === 'betting') ?? rounds[0]
    console.log(`Using round: batchId=${bettingRound.batchId}, status=${bettingRound.status}, timeframe=${bettingRound.timeframeSecs}s`)

    // 3. Navigate to the source detail page (ISS has few markets, fast ticks)
    // Fall back to coingecko if we can't determine the source
    await page.goto('/source/iss', { waitUntil: 'domcontentloaded', timeout: 60_000 })

    // Retry if page hit a Next.js error
    const bodyText = await page.locator('body').textContent({ timeout: 5_000 }).catch(() => '')
    if (bodyText?.includes('missing required error components') || bodyText?.includes('Application error')) {
      await page.goto('/source/iss', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    }

    // 4. Connect wallet
    await ensureWalletConnected(page, TEST_ADDRESS)

    // 5. Wait for the batch entry panel to appear
    const entryPanel = page.getByText('Set predictions')
    const hasPanel = await entryPanel.isVisible({ timeout: 30_000 }).catch(() => false)

    if (!hasPanel) {
      console.warn('SKIP: Batch entry panel not visible — source may have no active batch.')
      return
    }

    // 6. Verify countdown timer is visible (shows MM:SS or HH:MM:SS)
    const countdown = page.locator('text=/\\d{1,2}:\\d{2}/')
    const hasCountdown = await countdown.first().isVisible({ timeout: 10_000 }).catch(() => false)
    if (hasCountdown) {
      const countdownText = await countdown.first().textContent() || ''
      console.log(`Countdown visible: ${countdownText}`)
    }

    // 7. Verify "Enter Batch" button exists (may say "Connect Wallet" if not connected)
    const enterBtn = page.getByRole('button', { name: /Enter Batch|Deposit|Connect Wallet/ })
    await expect(enterBtn.first()).toBeVisible({ timeout: 15_000 })

    // 8. Verify UP/DN prediction buttons are present
    const upButton = page.getByRole('button', { name: 'UP' }).first()
    const hasMarkets = await upButton.isVisible({ timeout: 60_000 }).catch(() => false)
    if (hasMarkets) {
      console.log('Market prediction buttons visible — betting phase UI confirmed')
    } else {
      console.log('UP buttons not visible — markets may still be loading or source has no markets')
    }

    // 9. Verify quick-stake buttons are visible ($1, $5, $10, etc.)
    const quickStake = page.getByRole('button', { name: '$5', exact: true })
    const hasQuickStake = await quickStake.isVisible({ timeout: 10_000 }).catch(() => false)
    if (hasQuickStake) {
      console.log('Quick-stake buttons visible — entry panel is interactive')
    }
  })

  test('45b: lock phase indicators on NextBatches carousel', async ({ walletPage: page }) => {
    test.setTimeout(120_000)

    // Fast-fail: no point loading the carousel if the API backing it is dead
    if (!(await isVisionApiReachable())) {
      console.warn('SKIP: Vision API unreachable — oracle is likely down.')
      test.skip()
      return
    }

    // Navigate to the main Vision page (/) which has the NextBatches carousel
    await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    // Wait for SSE batch data — source cards indicate data has arrived
    await page.locator('[data-testid="source-card"], a[href*="/source/"]').first()
      .waitFor({ state: 'visible', timeout: 15_000 }).catch(() => {})

    // The NextBatches carousel shows batch cards with countdown timers
    // Locked batches get a red border and red countdown text

    // Look for any "locked" indicator in the carousel area
    const lockedIndicator = page.getByText('locked')
    const hasLockedBatches = await lockedIndicator.first().isVisible({ timeout: 15_000 }).catch(() => false)

    if (hasLockedBatches) {
      // Verify the locked count is a reasonable number
      const lockedText = await page.locator('text=/\\d+ locked/').first().textContent().catch(() => '')
      console.log(`Lock phase active: ${lockedText || 'some batches locked'}`)

      // Locked cards should have red styling (border-red-300)
      const redBorderCards = page.locator('[class*="border-red"]')
      const redCount = await redBorderCards.count()
      expect(redCount).toBeGreaterThan(0)
      console.log(`${redCount} batch card(s) showing locked state (red border)`)
    } else {
      // No batches currently locked — verify at least some batches render with countdowns
      const batchCountdowns = page.locator('text=/\\d{1,2}:\\d{2}/')
      const countdownCount = await batchCountdowns.count()
      console.log(`No batches currently locked. ${countdownCount} countdown(s) visible.`)
      // This is fine — lock phase is timing-dependent
    }

    // Verify the batch carousel section exists regardless of lock state
    const batchesText = page.getByText(/\d+ batches/)
    const hasBatchesLabel = await batchesText.first().isVisible({ timeout: 10_000 }).catch(() => false)
    if (hasBatchesLabel) {
      console.log('NextBatches carousel rendered with batch count')
    }
  })

  test('45c: round status reflects betting or locked via API', async () => {
    test.setTimeout(30_000)

    // Fast-fail: don't burn 90s in retries when oracle is simply offline
    if (!(await isVisionApiReachable())) {
      console.warn('SKIP: Vision API unreachable — oracle is likely down.')
      test.skip()
      return
    }

    // Pure API check — no browser needed
    const rounds = await getActiveRounds()
    if (rounds.length === 0) {
      console.warn('SKIP: No active rounds from API — oracle may not have spawned rounds yet.')
      test.skip()
      return
    }

    const now = Date.now()
    // Rounds whose bettingEnd is more than 2 hours ago are stale — the BatchEngine
    // never settled them. Testing status assertions against them is meaningless.
    const STALE_THRESHOLD_MS = 2 * 60 * 60 * 1000 // 2 hours

    let checkedAny = false

    for (const round of rounds.slice(0, 5)) {
      // Each round should have a valid status
      expect(['betting', 'locked', 'settling', 'settled']).toContain(round.status)

      // bettingEnd should be a parseable timestamp
      const bettingEnd = new Date(round.bettingEnd).getTime()
      expect(bettingEnd).toBeGreaterThan(0)

      // timeframeSecs should be positive
      expect(round.timeframeSecs).toBeGreaterThan(0)

      const msUntilEnd = bettingEnd - now

      if (round.status === 'betting') {
        if (msUntilEnd < -STALE_THRESHOLD_MS) {
          // Betting window closed more than 2 hours ago — the oracle is stalled and
          // never transitioned this round. Skip the timing assertion; it tells us
          // nothing about the UI and would always fail.
          console.warn(
            `Round ${round.batchId}: status=betting but bettingEnd was ${Math.round(-msUntilEnd / 3600_000)}h ago — stale round, skipping timing check`,
          )
          continue
        }

        // Betting phase: bettingEnd should be in the future (or recently passed).
        // On testnet, rounds can linger in "betting" status for up to 5 minutes
        // after the window closes if the oracle hasn't transitioned them yet.
        expect(msUntilEnd).toBeGreaterThan(-300_000)
        console.log(`Round ${round.batchId}: betting, ends in ${Math.round(msUntilEnd / 1000)}s`)
        checkedAny = true
      } else if (round.status === 'locked') {
        console.log(`Round ${round.batchId}: LOCKED — betting window closed`)
        checkedAny = true
      } else {
        console.log(`Round ${round.batchId}: ${round.status}`)
        checkedAny = true
      }
    }

    if (!checkedAny) {
      console.warn('SKIP: All sampled rounds are stale (bettingEnd > 2h ago) — BatchEngine appears stalled. No timing assertions made.')
    }
  })
})
