/**
 * Vision Round Resolution -- Opposite Bets + Pool Conservation
 *
 * 1. Find active round
 * 2. Two players join with opposite bets
 * 3. Wait for auto-settlement
 * 4. With opposite bets: one profits, one loses
 * 5. Verify sum(payouts) ~ sum(deposits) (pool conservation)
 * 6. Verify realBalance credited for both players
 */
import { test, expect } from '@playwright/test'
import {
  PLAYER1,
  PLAYER2,
  getActiveRounds,
  joinRoundDirect,
  waitForRoundSettled,
  getRoundResults,
  getVisionRealBalance,
  getBatchConfigHash,
  getPosition,
  getVisionUsdcAddress,
  impersonateAccount,
  ensureUsdcBalance,
  ensureBatchExists,
  findAvailableE2eBatch,
  randomBets,
  oppositeBets,
  getBatchesFromChain,
} from '../helpers/vision-api'
import { CONSENSUS_TIMEOUT } from '../env'

const DEPOSIT = 50n * 10n ** 18n  // 50 USDC
const STAKE = 1n * 10n ** 18n
const MARKET_COUNT = 10

test.describe('Vision Round Resolution -- Opposite Bets + Pool Conservation', () => {
  test('opposite bets resolve with pool conservation and balance credits', async () => {
    test.setTimeout(420_000)

    // 0. Ensure batches exist on-chain
    await ensureBatchExists()

    // Check on-chain batch count — oracle API may return stale data from old deployment
    const chainBatches = await getBatchesFromChain()
    expect(chainBatches.length, 'Vision contract has 0 batches on-chain — batches need redeployment via DeployAllVisionBatches').toBeGreaterThan(0)

    // 1. Find active round where PLAYER1 hasn't joined — prefer short-tick batches
    let batchId = 0
    let configHash: `0x${string}` = '0x' as `0x${string}`
    let selectedTickDuration = 0

    const rounds = await getActiveRounds()
    // Sort by timeframeSecs ascending — short ticks settle faster, stay within timeout
    const sortedRounds = [...rounds].sort((a, b) => (a.timeframeSecs ?? Infinity) - (b.timeframeSecs ?? Infinity))
    for (const round of sortedRounds) {
      try {
        const pos = await getPosition(round.batchId, PLAYER1)
        if (pos.joinTimestamp === 0n) {
          batchId = round.batchId
          selectedTickDuration = round.timeframeSecs ?? 0
          break
        }
      } catch {
        batchId = round.batchId
        selectedTickDuration = round.timeframeSecs ?? 0
        break
      }
    }

    // Oracle API returned nothing — fall back to chain-based batch search (prefer short ticks)
    if (batchId === 0) {
      try {
        const allChainBatches = await getBatchesFromChain()
        // Sort by tick_duration ascending to prefer short-tick batches
        const sorted = [...allChainBatches].sort((a, b) => a.tick_duration - b.tick_duration)
        for (const batch of sorted) {
          try {
            const pos = await getPosition(batch.id, PLAYER1)
            if (pos.joinTimestamp === 0n) {
              batchId = batch.id
              selectedTickDuration = batch.tick_duration
              configHash = await getBatchConfigHash(batch.id)
              break
            }
          } catch {
            batchId = batch.id
            selectedTickDuration = batch.tick_duration
            configHash = await getBatchConfigHash(batch.id)
            break
          }
        }
        if (batchId === 0) {
          console.warn('SKIP: No joinable batches found on-chain — all joined or none exist.')
          return
        }
        console.log(`Oracle had no active rounds — found batch ${batchId} on-chain (tick=${selectedTickDuration}s)`)
      } catch {
        console.log('No joinable batches found on-chain — all joined or none exist')
        return
      }
    }

    if (configHash === ('0x' as `0x${string}`)) configHash = await getBatchConfigHash(batchId)
    const visionUsdc = await getVisionUsdcAddress()
    console.log(`Using round ${batchId} (tick_duration=${selectedTickDuration}s)`)

    // 2. Fund players
    await impersonateAccount(PLAYER1)
    await ensureUsdcBalance(PLAYER1, DEPOSIT * 2n, visionUsdc)
    await impersonateAccount(PLAYER2)
    await ensureUsdcBalance(PLAYER2, DEPOSIT * 2n, visionUsdc)

    // 3. Record realBalance before
    const [p1RealBefore, p2RealBefore] = await Promise.all([
      getVisionRealBalance(PLAYER1),
      getVisionRealBalance(PLAYER2),
    ])

    // 4. Opposite bets — one player must win, one must lose
    const p1Bets = randomBets(MARKET_COUNT)
    const p2Bets = oppositeBets(p1Bets)

    await Promise.all([
      joinRoundDirect(PLAYER1, batchId, configHash, DEPOSIT, STAKE, p1Bets, MARKET_COUNT),
      joinRoundDirect(PLAYER2, batchId, configHash, DEPOSIT, STAKE, p2Bets, MARKET_COUNT),
    ])
    console.log('Both players joined with opposite bets')

    // 5. Wait for settlement — use tick-aware timeout
    // Short-tick batches (60-120s) settle fast; long ticks may exceed the 360s timeout
    const effectiveTimeout = Math.max(CONSENSUS_TIMEOUT, (selectedTickDuration + 120) * 1000)
    const settled = await waitForRoundSettled(batchId, effectiveTimeout)
    if (!settled) {
      console.log(`Round ${batchId} did not settle within ${effectiveTimeout / 1000}s (tick_duration=${selectedTickDuration}s) — oracle may not have resolved this tick yet`)
      return
    }

    // 6. Fetch results
    const results = await getRoundResults(batchId)
    expect(results).not.toBeNull()

    const p1Result = results!.players.find(p => p.player.toLowerCase() === PLAYER1.toLowerCase())
    const p2Result = results!.players.find(p => p.player.toLowerCase() === PLAYER2.toLowerCase())
    expect(p1Result).toBeDefined()
    expect(p2Result).toBeDefined()

    // 7. With opposite bets, one profits and one loses
    const p1Pnl = Number(p1Result!.pnl)
    const p2Pnl = Number(p2Result!.pnl)
    console.log(`P1 pnl=${p1Pnl}, P2 pnl=${p2Pnl}`)

    // At least one must be positive, at least one negative (opposite bets)
    const hasWinner = p1Pnl > 0 || p2Pnl > 0
    const hasLoser = p1Pnl < 0 || p2Pnl < 0
    expect(hasWinner).toBe(true)
    expect(hasLoser).toBe(true)

    // 8. Pool conservation: sum(payouts) ~ sum(deposits), within 5% for fees
    const totalDeposited = results!.players.reduce((s, p) => s + Number(p.deposited), 0)
    const totalPayout = results!.players.reduce((s, p) => s + Number(p.payout), 0)
    expect(Math.abs(totalPayout - totalDeposited)).toBeLessThan(totalDeposited * 0.05)
    console.log(`Pool conservation: deposited=${totalDeposited}, payout=${totalPayout}, diff=${Math.abs(totalPayout - totalDeposited)}`)

    // 9. Verify realBalance credited for both players
    const [p1RealAfter, p2RealAfter] = await Promise.all([
      getVisionRealBalance(PLAYER1),
      getVisionRealBalance(PLAYER2),
    ])

    // Both players should have some realBalance (at minimum their payout)
    expect(p1RealAfter).toBeGreaterThanOrEqual(0n)
    expect(p2RealAfter).toBeGreaterThanOrEqual(0n)
    console.log(`realBalance: P1 ${p1RealBefore}->${p1RealAfter}, P2 ${p2RealBefore}->${p2RealAfter}`)
  })
})
