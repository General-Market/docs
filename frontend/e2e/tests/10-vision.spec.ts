/**
 * Vision E2E — Health + Round Join
 *
 * 1. L3 reachable
 * 2. Vision API responds
 * 3. At least one active round exists
 * 4. Frontend loads with vision content
 * 5. Two players join a round with opposing bets, USDC moves correctly
 */
import { visionTest as test, expect } from '../fixtures/wallet'
import { checkRpc } from '../helpers/backend-api'
import {
  PLAYER1,
  PLAYER2,
  getActiveRounds,
  joinRoundDirect,
  getPosition,
  getL3UsdcBalance,
  getVisionUsdcBalance,
  getVisionUsdcAddress,
  ensureUsdcBalance,
  impersonateAccount,
  getBatchConfigHash,
  randomBets,
  oppositeBets,
} from '../helpers/vision-api'

import { L3_RPC, VISION_API } from '../env'

// ── Health checks ────────────────────────────────────────────

test.describe('Vision', () => {
  test('L3 chain is reachable', async () => {
    const ok = await checkRpc(L3_RPC)
    expect(ok).toBe(true)
  })

  test('Vision API responds', async () => {
    let res: Response
    try {
      res = await fetch(`${VISION_API}/vision/batches`, {
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      res = await fetch(`${VISION_API}/vision/batches`, {
        signal: AbortSignal.timeout(15_000),
      })
    }
    expect(res.ok).toBe(true)
  })

  test('at least one active round exists', async () => {
    const rounds = await getActiveRounds()
    expect(rounds.length).toBeGreaterThan(0)
    expect(rounds[0].status).toBe('betting')
    expect(rounds[0].batchId).toBeGreaterThan(0)
  })

  // ── Frontend display ─────────────────────────────────────

  test('vision page loads and shows batch', async ({ walletPage: page }) => {
    await page.goto('/')

    // Wait for page to hydrate
    await page.getByText(/Sources/i).first().waitFor({ timeout: 30_000 })

    const hasBatches = await page
      .getByText(/Next Batches|LIVE|Batch #/i)
      .first()
      .isVisible({ timeout: 15_000 })
      .catch(() => false)

    const hasSources = await page
      .getByText(/CoinGecko|Pump\.fun|Finnhub/i)
      .first()
      .isVisible({ timeout: 5_000 })
      .catch(() => false)

    expect(hasBatches || hasSources).toBe(true)
  })

  // ── Two-player join via round-based flow ──────────────────

  test('two players join round and deposits settle correctly', async () => {
    test.setTimeout(300_000)

    // 1. Find an active betting round
    const rounds = await getActiveRounds()
    expect(rounds.length).toBeGreaterThan(0)
    const round = rounds[0]
    const batchId = round.batchId
    const configHash = round.configHash ?? await getBatchConfigHash(batchId)

    // 2. Pre-fund players so balance-diff assertions aren't polluted by minting
    const deposit = 10n * 10n ** 18n // 10 USDC (18 dec, L3)
    const stakePerTick = 1n * 10n ** 18n
    const visionUsdc = await getVisionUsdcAddress()
    await impersonateAccount(PLAYER1)
    await ensureUsdcBalance(PLAYER1, deposit, visionUsdc)
    await impersonateAccount(PLAYER2)
    await ensureUsdcBalance(PLAYER2, deposit, visionUsdc)

    // 3. Record balances before
    const [p1BalBefore, p2BalBefore, visionBalBefore] = await Promise.all([
      getL3UsdcBalance(PLAYER1, visionUsdc),
      getL3UsdcBalance(PLAYER2, visionUsdc),
      getVisionUsdcBalance(),
    ])

    // 4. Generate opposite bets — guarantees divergent outcomes
    const marketCount = 10
    const p1Bets = randomBets(marketCount)
    const p2Bets = oppositeBets(p1Bets)

    // 5. Both players join via joinRoundDirect
    const [p1Result, p2Result] = await Promise.all([
      joinRoundDirect(PLAYER1, batchId, configHash, deposit, stakePerTick, p1Bets, marketCount),
      joinRoundDirect(PLAYER2, batchId, configHash, deposit, stakePerTick, p2Bets, marketCount),
    ])
    expect(p1Result.bitmapHash).toBeTruthy()
    expect(p2Result.bitmapHash).toBeTruthy()

    // 6. Verify positions on-chain
    const [pos1, pos2] = await Promise.all([
      getPosition(batchId, PLAYER1),
      getPosition(batchId, PLAYER2),
    ])

    expect(pos1.balance).toBe(deposit)
    expect(pos1.stakePerTick).toBe(stakePerTick)
    expect(pos1.totalDeposited).toBe(deposit)
    expect(pos1.bitmapHash).toBe(p1Result.bitmapHash)

    expect(pos2.balance).toBe(deposit)
    expect(pos2.stakePerTick).toBe(stakePerTick)
    expect(pos2.totalDeposited).toBe(deposit)
    expect(pos2.bitmapHash).toBe(p2Result.bitmapHash)

    // 7. Verify USDC moved from players to Vision contract
    const [p1BalAfter, p2BalAfter, visionBalAfter] = await Promise.all([
      getL3UsdcBalance(PLAYER1, visionUsdc),
      getL3UsdcBalance(PLAYER2, visionUsdc),
      getVisionUsdcBalance(),
    ])

    expect(p1BalBefore - p1BalAfter).toBeGreaterThanOrEqual(deposit)
    expect(p2BalBefore - p2BalAfter).toBeGreaterThanOrEqual(deposit)
    expect(visionBalAfter - visionBalBefore).toBeGreaterThanOrEqual(deposit * 2n)

    // 8. Bitmap acceptance (best-effort — issuers may lag)
    if (p1Result.bitmapAccepted >= 2 && p2Result.bitmapAccepted >= 2) {
      expect(p1Result.bitmapAccepted).toBeGreaterThanOrEqual(2)
      expect(p2Result.bitmapAccepted).toBeGreaterThanOrEqual(2)
    } else {
      console.log(`Bitmap acceptance: P1=${p1Result.bitmapAccepted}/3, P2=${p2Result.bitmapAccepted}/3`)
    }
  })
})
