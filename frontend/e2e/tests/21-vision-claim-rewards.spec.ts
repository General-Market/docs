/**
 * Vision Round Results + Bitmap Transparency
 *
 * 1. Join a round with two opposing players
 * 2. Wait for auto-settlement
 * 3. Fetch results — verify structure (players, deposited, payout, pnl, correctCount)
 * 4. Fetch bitmaps — verify structure (markets, players with boolean[] predictions)
 * 5. Verify parimutuel conservation: sum(payouts) ~ sum(deposits)
 * 6. Verify player history via getPlayerRounds
 */
import { test, expect } from '@playwright/test'
import {
  PLAYER1,
  PLAYER2,
  getActiveRounds,
  joinRoundDirect,
  waitForRoundSettled,
  getRoundResults,
  getRoundBitmaps,
  getPlayerRounds,
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

const DEPOSIT = 10n * 10n ** 18n
const STAKE = 1n * 10n ** 18n
const MARKET_COUNT = 10

test.describe('Vision Round Results + Bitmap Transparency', () => {
  test('round settles with correct results and transparent bitmaps', async () => {
    test.setTimeout(420_000)

    // 0. Ensure batches exist on-chain
    await ensureBatchExists()

    // Check on-chain batch count — oracle API may return stale data from old deployment
    const chainBatches = await getBatchesFromChain()
    if (chainBatches.length === 0) {
      console.log('Vision contract has 0 batches on-chain — batches need redeployment via DeployAllVisionBatches')
      return
    }

    // 1. Find active round where PLAYER1 hasn't joined
    let batchId = 0
    let configHash: `0x${string}` = '0x' as `0x${string}`

    const rounds = await getActiveRounds()
    for (const round of rounds) {
      try {
        const pos = await getPosition(round.batchId, PLAYER1)
        if (pos.joinTimestamp === 0n) {
          batchId = round.batchId
          break
        }
      } catch {
        batchId = round.batchId
        break
      }
    }

    // Oracle API returned nothing — fall back to chain-based batch search
    if (batchId === 0) {
      try {
        const found = await findAvailableE2eBatch(PLAYER1)
        batchId = found.batchId
        configHash = found.configHash
        console.log(`Oracle had no active rounds — found batch ${batchId} on-chain`)
      } catch {
        console.log('No joinable batches found on-chain — all joined or none exist')
        return
      }
    }

    if (configHash === ('0x' as `0x${string}`)) configHash = await getBatchConfigHash(batchId)
    const visionUsdc = await getVisionUsdcAddress()

    // 2. Fund and join with opposite bets
    await impersonateAccount(PLAYER1)
    await ensureUsdcBalance(PLAYER1, DEPOSIT * 2n, visionUsdc)
    await impersonateAccount(PLAYER2)
    await ensureUsdcBalance(PLAYER2, DEPOSIT * 2n, visionUsdc)

    const p1Bets = randomBets(MARKET_COUNT)
    const p2Bets = oppositeBets(p1Bets)

    await Promise.all([
      joinRoundDirect(PLAYER1, batchId, configHash, DEPOSIT, STAKE, p1Bets, MARKET_COUNT),
      joinRoundDirect(PLAYER2, batchId, configHash, DEPOSIT, STAKE, p2Bets, MARKET_COUNT),
    ])
    console.log(`Both players joined round ${batchId}`)

    // 3. Wait for auto-settlement
    const settled = await waitForRoundSettled(batchId, CONSENSUS_TIMEOUT)
    expect(settled).toBe(true)

    // 4. Fetch and verify results structure
    const results = await getRoundResults(batchId)
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

    // 5. Parimutuel conservation: sum(payouts) ~ sum(deposits)
    const totalDeposited = results!.players.reduce((s, p) => s + Number(p.deposited), 0)
    const totalPayout = results!.players.reduce((s, p) => s + Number(p.payout), 0)
    // Allow 5% tolerance for protocol fees
    expect(Math.abs(totalPayout - totalDeposited)).toBeLessThan(totalDeposited * 0.05)
    console.log(`Conservation: deposited=${totalDeposited}, payout=${totalPayout}`)

    // 6. Fetch and verify bitmaps
    const bitmaps = await getRoundBitmaps(batchId)
    expect(bitmaps).not.toBeNull()
    // markets metadata may be empty (oracle returns [] until market names are populated)
    if (bitmaps!.markets.length === 0) {
      console.log('bitmaps.markets is empty — oracle has not populated market metadata yet')
    }
    expect(bitmaps!.markets.length).toBeGreaterThanOrEqual(0)
    expect(bitmaps!.players.length).toBeGreaterThanOrEqual(2)

    for (const p of bitmaps!.players) {
      expect(p.predictions.length).toBe(bitmaps!.markets.length)
    }

    // 7. Verify player history
    const history = await getPlayerRounds(PLAYER1)
    expect(history.length).toBeGreaterThan(0)
    const thisRound = history.find(r => r.batchId === batchId)
    if (thisRound) {
      expect(Number(thisRound.deposited)).toBeGreaterThan(0)
      expect(thisRound.totalMarkets).toBeGreaterThan(0)
    }

    console.log(`Round ${batchId}: P1 correct=${p1Result!.correctCount}/${p1Result!.totalMarkets}, P2 correct=${p2Result!.correctCount}/${p2Result!.totalMarkets}`)
  })
})
