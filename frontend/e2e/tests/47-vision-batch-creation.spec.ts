/**
 * Vision Batch Creation + Join
 *
 * When the Vision contract has nextBatchId=0, every join test collapses.
 * This test creates a batch from nothing, verifies it on-chain, joins it,
 * and verifies the position. The foundation the other four tests stand on.
 *
 * 1. Read nextBatchId — if >0, skip creation (batches already exist)
 * 2. Create batch via Anvil storage manipulation (BLS bypass)
 * 3. Verify batch exists on-chain via getBatch
 * 4. PLAYER1 deposits USDC, joins batch via joinBatchDirect
 * 5. Verify position on-chain
 */
import { test, expect } from '@playwright/test'
import {
  PLAYER1,
  createBatchViaStorage,
  getBatchesFromChain,
  getBatchConfigHash,
  getPosition,
  getVisionUsdcAddress,
  impersonateAccount,
  ensureUsdcBalance,
  randomBets,
  joinRoundDirect,
} from '../helpers/vision-api'
import { IS_ANVIL } from '../env'

const DEPOSIT = 10n * 10n ** 18n  // 10 USDC (18 dec, L3)
const STAKE = 1n * 10n ** 18n     // 1 USDC per tick
const MARKET_COUNT = 10

test.describe('Vision Batch Creation + Join', () => {
  test('create batch when none exist, then join it', async () => {
    test.skip(!IS_ANVIL, 'Storage manipulation requires Anvil')
    test.setTimeout(120_000)

    // 1. Check current batch count
    const existingBatches = await getBatchesFromChain()
    let batchId: number

    if (existingBatches.length > 0) {
      console.log(`${existingBatches.length} batches already exist — using batch 0`)
      batchId = existingBatches[0].id
    } else {
      // 2. Create batch via storage
      console.log('nextBatchId=0 — creating batch via storage')
      batchId = await createBatchViaStorage({
        tickDuration: 120,
        lockOffset: 10,
      })
      console.log(`Created batch ${batchId}`)
    }

    // 3. Verify batch exists on-chain
    const batches = await getBatchesFromChain()
    expect(batches.length).toBeGreaterThan(0)

    const batch = batches.find(b => b.id === batchId)
    expect(batch).toBeDefined()
    expect(batch!.tick_duration).toBeGreaterThan(0)
    expect(batch!.paused).toBe(false)

    const configHash = await getBatchConfigHash(batchId)
    expect(configHash).not.toBe('0x' + '0'.repeat(64))

    console.log(`Batch ${batchId} verified: tickDuration=${batch!.tick_duration}, configHash=${configHash.slice(0, 18)}...`)

    // 4. Fund PLAYER1 and join
    await impersonateAccount(PLAYER1)
    const visionUsdc = await getVisionUsdcAddress()
    await ensureUsdcBalance(PLAYER1, DEPOSIT * 2n, visionUsdc)

    const bets = randomBets(MARKET_COUNT)
    const result = await joinRoundDirect(
      PLAYER1, batchId, configHash, DEPOSIT, STAKE, bets, MARKET_COUNT,
    )
    expect(result.bitmapHash).toBeTruthy()

    // 5. Verify position on-chain
    const pos = await getPosition(batchId, PLAYER1)
    expect(pos.balance).toBe(DEPOSIT)
    expect(pos.stakePerTick).toBe(STAKE)
    expect(pos.totalDeposited).toBe(DEPOSIT)
    expect(pos.bitmapHash).toBe(result.bitmapHash)
    expect(pos.joinTimestamp).toBeGreaterThan(0n)

    console.log(`PLAYER1 joined batch ${batchId}: balance=${pos.balance}, stake=${pos.stakePerTick}`)
  })
})
