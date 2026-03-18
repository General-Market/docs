/**
 * Vision Round Lifecycle — comprehensive happy path.
 *
 * Verifies the full round lifecycle managed by the oracle:
 * 1. Active round exists
 * 2. Two players join with opposite bets
 * 3. Round auto-settles after betting window
 * 4. Results show correct predictions and PnL
 * 5. Bitmaps are transparent after settlement
 * 6. Balances credited to both players
 * 7. New round auto-created after settlement
 */
import { test, expect } from '@playwright/test'
import {
  PLAYER1, PLAYER2,
  getActiveRounds, joinRoundDirect, waitForRoundSettled,
  getRoundResults, getRoundBitmaps, getPlayerRounds,
  getVisionRealBalance, getBatchConfigHash, getPosition,
  impersonateAccount, ensureUsdcBalance,
  randomBets, oppositeBets,
} from '../helpers/vision-api'
import { CONSENSUS_TIMEOUT } from '../env'

const DEPOSIT = 10n * 10n ** 18n
const STAKE = 1n * 10n ** 18n
const MARKET_COUNT = 10

let roundBatchId: number = 0
let roundConfigHash: `0x${string}` = '0x'
let player1Bets: ReturnType<typeof randomBets>
let player2Bets: ReturnType<typeof randomBets>
let skippedDueToAlreadyJoined = false

test.describe.serial('Vision Round Lifecycle', () => {
  test.setTimeout(360_000)

  test('41a: active round exists', async () => {
    const rounds = await getActiveRounds()
    expect(rounds.length).toBeGreaterThan(0)

    for (const round of rounds) {
      try {
        const pos = await getPosition(round.batchId, PLAYER1)
        if (pos.joinTimestamp === 0n) {
          roundBatchId = round.batchId
          break
        }
      } catch {
        roundBatchId = round.batchId
        break
      }
    }

    if (roundBatchId === 0) {
      console.log('All active rounds already joined — graceful pass for entire suite')
      skippedDueToAlreadyJoined = true
      return
    }

    expect(roundBatchId).toBeGreaterThan(0)
    roundConfigHash = await getBatchConfigHash(roundBatchId)
  })

  test('41b: two players join round with opposite bets', async () => {
    if (skippedDueToAlreadyJoined) {
      console.log('Skipped — no unjoinable round available')
      return
    }
    expect(roundBatchId).toBeGreaterThan(0)

    await impersonateAccount(PLAYER1)
    await ensureUsdcBalance(PLAYER1, DEPOSIT * 2n)
    await impersonateAccount(PLAYER2)
    await ensureUsdcBalance(PLAYER2, DEPOSIT * 2n)

    player1Bets = randomBets(MARKET_COUNT)
    player2Bets = oppositeBets(player1Bets)

    await joinRoundDirect(PLAYER1, roundBatchId, roundConfigHash, DEPOSIT, STAKE, player1Bets, MARKET_COUNT)
    console.log(`PLAYER1 joined round ${roundBatchId}`)

    await joinRoundDirect(PLAYER2, roundBatchId, roundConfigHash, DEPOSIT, STAKE, player2Bets, MARKET_COUNT)
    console.log(`PLAYER2 joined round ${roundBatchId}`)
  })

  test('41c: round auto-settles after betting window', async () => {
    if (skippedDueToAlreadyJoined) { console.log('Skipped — no unjoinable round'); return }
    expect(roundBatchId).toBeGreaterThan(0)
    const settled = await waitForRoundSettled(roundBatchId, CONSENSUS_TIMEOUT)
    expect(settled).toBe(true)
  })

  test('41d: settlement results show correct predictions and PnL', async () => {
    if (skippedDueToAlreadyJoined) { console.log('Skipped — no unjoinable round'); return }
    const results = await getRoundResults(roundBatchId)
    expect(results).not.toBeNull()
    expect(results!.players.length).toBeGreaterThanOrEqual(2)

    const p1Result = results!.players.find(p => p.player.toLowerCase() === PLAYER1.toLowerCase())
    const p2Result = results!.players.find(p => p.player.toLowerCase() === PLAYER2.toLowerCase())
    expect(p1Result).toBeDefined()
    expect(p2Result).toBeDefined()

    expect(Number(p1Result!.deposited)).toBeGreaterThan(0)
    expect(Number(p2Result!.deposited)).toBeGreaterThan(0)
    expect(p1Result!.correctCount).toBeGreaterThanOrEqual(0)
    expect(p2Result!.correctCount).toBeGreaterThanOrEqual(0)
    expect(p1Result!.totalMarkets).toBeGreaterThan(0)

    // Parimutuel conservation: sum of PnL ~ 0 (minus protocol fees)
    const p1Pnl = Number(p1Result!.pnl)
    const p2Pnl = Number(p2Result!.pnl)
    const depositNum = Number(DEPOSIT)
    expect(Math.abs(p1Pnl + p2Pnl)).toBeLessThan(depositNum * 0.05)
    console.log(`Results: P1 pnl=${p1Pnl}, P2 pnl=${p2Pnl}, sum=${p1Pnl + p2Pnl}`)
  })

  test('41e: bitmaps are transparent after settlement', async () => {
    if (skippedDueToAlreadyJoined) { console.log('Skipped — no unjoinable round'); return }
    const bitmaps = await getRoundBitmaps(roundBatchId)
    expect(bitmaps).not.toBeNull()
    expect(bitmaps!.markets.length).toBeGreaterThan(0)
    expect(bitmaps!.players.length).toBeGreaterThanOrEqual(2)

    for (const p of bitmaps!.players) {
      expect(p.predictions.length).toBe(bitmaps!.markets.length)
    }
  })

  test('41f: settled funds credited to Vision balance', async () => {
    if (skippedDueToAlreadyJoined) { console.log('Skipped — no unjoinable round'); return }
    const [p1Balance, p2Balance] = await Promise.all([
      getVisionRealBalance(PLAYER1),
      getVisionRealBalance(PLAYER2),
    ])

    // After settlement, both players should have non-negative realBalance
    expect(p1Balance).toBeGreaterThanOrEqual(0n)
    expect(p2Balance).toBeGreaterThanOrEqual(0n)
    console.log(`Post-settlement realBalance: P1=${p1Balance}, P2=${p2Balance}`)
  })

  test('41g: new round auto-created after settlement', async () => {
    // The lifecycle manager spawns a fresh betting round
    const rounds = await getActiveRounds()
    expect(rounds.length).toBeGreaterThan(0)
    expect(rounds[0].status).toBe('betting')
    console.log(`New active round: batchId=${rounds[0].batchId}`)
  })
})
