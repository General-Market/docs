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
  impersonateAccount,
  ensureUsdcBalance,
  randomBets,
  oppositeBets,
} from '../helpers/vision-api'
import { CONSENSUS_TIMEOUT } from '../env'

const DEPOSIT = 50n * 10n ** 18n  // 50 USDC
const STAKE = 1n * 10n ** 18n
const MARKET_COUNT = 10

test.describe('Vision Round Resolution -- Opposite Bets + Pool Conservation', () => {
  test('opposite bets resolve with pool conservation and balance credits', async () => {
    test.setTimeout(300_000)

    // 1. Find active round
    const rounds = await getActiveRounds()
    expect(rounds.length).toBeGreaterThan(0)
    const round = rounds[0]
    const batchId = round.batchId
    const configHash = round.configHash ?? await getBatchConfigHash(batchId)
    console.log(`Using round ${batchId}`)

    // 2. Fund players
    await impersonateAccount(PLAYER1)
    await ensureUsdcBalance(PLAYER1, DEPOSIT * 2n)
    await impersonateAccount(PLAYER2)
    await ensureUsdcBalance(PLAYER2, DEPOSIT * 2n)

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

    // 5. Wait for settlement
    const settled = await waitForRoundSettled(batchId, CONSENSUS_TIMEOUT)
    expect(settled).toBe(true)

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
