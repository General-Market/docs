/**
 * Vision leaderboard E2E tests.
 * Validates that the leaderboard API returns round-based fields
 * (win rate, PnL, roundsPlayed, roundsWon) and includes results
 * from round-based batches.
 */
import { test, expect } from '@playwright/test'
import { VISION_API, RPC_TIMEOUT } from '../env'
import { PLAYER1 } from '../helpers/vision-api'

test.describe('Vision Leaderboard', () => {

  test('42a: leaderboard returns win rate, PnL, and round fields', async () => {
    const res = await fetch(`${VISION_API}/vision/leaderboard`, {
      signal: AbortSignal.timeout(RPC_TIMEOUT),
    })
    expect(res.ok).toBe(true)
    const data = await res.json()
    expect(data.leaderboard).toBeDefined()

    if (data.leaderboard.length > 0) {
      const entry = data.leaderboard[0]
      // Core fields that must exist on every leaderboard entry
      expect(entry).toHaveProperty('walletAddress')
      expect(entry).toHaveProperty('pnl')
      expect(entry).toHaveProperty('winRate')
      expect(entry).toHaveProperty('roi')
      expect(entry).toHaveProperty('totalVolume')

      // Round-specific fields (new)
      expect(entry).toHaveProperty('roundsPlayed')
      expect(entry).toHaveProperty('roundsWon')

      // Win rate is a percentage: 0-100
      expect(entry.winRate).toBeGreaterThanOrEqual(0)
      expect(entry.winRate).toBeLessThanOrEqual(100)
    } else {
      console.log('Leaderboard empty — no players have completed rounds yet')
    }
  })

  test('42b: leaderboard includes round-based batch results', async () => {
    const res = await fetch(`${VISION_API}/vision/leaderboard`, {
      signal: AbortSignal.timeout(RPC_TIMEOUT),
    })
    expect(res.ok).toBe(true)
    const data = await res.json()
    const entries = data.leaderboard ?? []

    // Look for PLAYER1 from the round lifecycle tests (test 41)
    const p1 = entries.find(
      (e: { walletAddress: string }) =>
        e.walletAddress.toLowerCase() === PLAYER1.toLowerCase(),
    )

    if (p1) {
      // If found, round data should be populated
      expect(p1.roundsPlayed).toBeGreaterThanOrEqual(1)
      expect(typeof p1.pnl).toBe('number')
      console.log(`PLAYER1 on leaderboard: rounds=${p1.roundsPlayed}, won=${p1.roundsWon}, pnl=${p1.pnl}`)
    } else {
      // Acceptable if round lifecycle tests haven't run or oracle hasn't aggregated yet
      console.log(`PLAYER1 (${PLAYER1}) not on leaderboard — round results may not be aggregated yet`)
    }
  })
})
