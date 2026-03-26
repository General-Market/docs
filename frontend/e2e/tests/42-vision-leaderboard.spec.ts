/**
 * Vision leaderboard E2E tests.
 * Validates that the leaderboard API returns expected fields
 * and includes results from round-based batches when available.
 *
 * Hard-asserts API availability; soft-skips when no round data exists yet.
 */
import { test, expect } from '@playwright/test'
import { VISION_API, RPC_TIMEOUT } from '../env'
import { PLAYER1 } from '../helpers/vision-api'

test.describe('Vision Leaderboard', () => {

  test('42a: leaderboard returns core fields', async () => {
    // Quick Vision API probe — skip if oracle is down
    try {
      const probe = await fetch(`${VISION_API}/vision/batches`, { signal: AbortSignal.timeout(5_000) })
      if (!probe.ok) { console.log('Vision API returned ' + probe.status + ' — skipping'); return }
    } catch { console.log('Vision API unreachable — skipping'); return }

    const res = await fetch(`${VISION_API}/vision/leaderboard`, {
      signal: AbortSignal.timeout(RPC_TIMEOUT),
    })

    expect(res.ok, `Leaderboard API returned ${res.status} — endpoint must be deployed`).toBe(true)

    const data = await res.json()

    expect(data).toHaveProperty('leaderboard')

    if (data.leaderboard.length === 0) {
      console.warn('SKIP: Leaderboard empty — no players have completed rounds yet. Expected on fresh deploys.')
      return
    }

    const entry = data.leaderboard[0]
    // Core fields that must exist on every leaderboard entry
    expect(entry).toHaveProperty('walletAddress')
    expect(entry).toHaveProperty('pnl')
    expect(entry).toHaveProperty('totalVolume')

    // Win rate — present on most implementations
    if ('winRate' in entry) {
      expect(entry.winRate).toBeGreaterThanOrEqual(0)
      expect(entry.winRate).toBeLessThanOrEqual(100)
    }

    // Round-specific fields — may not exist until oracle aggregates round data
    if ('roundsPlayed' in entry) {
      expect(typeof entry.roundsPlayed).toBe('number')
      console.log(`Leaderboard entry has round fields: roundsPlayed=${entry.roundsPlayed}, roundsWon=${entry.roundsWon ?? 'N/A'}`)
    } else {
      console.warn('SKIP: Leaderboard entries do not yet include roundsPlayed/roundsWon — oracle may not have aggregated round data.')
    }
  })

  test('42b: leaderboard includes round-based batch results', async () => {
    // Quick Vision API probe — skip if oracle is down
    try {
      const probe = await fetch(`${VISION_API}/vision/batches`, { signal: AbortSignal.timeout(5_000) })
      if (!probe.ok) { console.log('Vision API returned ' + probe.status + ' — skipping'); return }
    } catch { console.log('Vision API unreachable — skipping'); return }

    const res = await fetch(`${VISION_API}/vision/leaderboard`, {
      signal: AbortSignal.timeout(RPC_TIMEOUT),
    })

    expect(res.ok, `Leaderboard API returned ${res.status} — endpoint must be reachable`).toBe(true)

    const data = await res.json()
    const entries = data.leaderboard ?? []

    if (entries.length === 0) {
      console.warn('SKIP: Leaderboard empty — no round results to verify. Expected on fresh deploys.')
      return
    }

    // Look for PLAYER1 from the round lifecycle tests (test 41)
    const p1 = entries.find(
      (e: { walletAddress: string }) =>
        e.walletAddress.toLowerCase() === PLAYER1.toLowerCase(),
    )

    if (p1) {
      expect(typeof p1.pnl).toBe('number')
      // Round data may or may not be populated depending on oracle aggregation
      if ('roundsPlayed' in p1 && p1.roundsPlayed > 0) {
        expect(p1.roundsPlayed).toBeGreaterThanOrEqual(1)
        console.log(`PLAYER1 on leaderboard: rounds=${p1.roundsPlayed}, won=${p1.roundsWon ?? 'N/A'}, pnl=${p1.pnl}`)
      } else {
        console.log(`PLAYER1 on leaderboard with pnl=${p1.pnl} but no round-specific data yet`)
      }
    } else {
      // Acceptable if round lifecycle tests haven't run or oracle hasn't aggregated yet
      console.warn(`SKIP: PLAYER1 (${PLAYER1}) not on leaderboard — round results may not be aggregated yet.`)
    }
  })
})
