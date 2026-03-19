/**
 * Vision Leaderboard E2E
 *
 * Verifies:
 * 1. Global leaderboard returns players with non-zero PnL
 * 2. Per-source leaderboard returns data (not all zeros)
 * 3. Frontend proxy routes work correctly
 */
import { visionTest as test, expect } from '../fixtures/wallet'
import { VISION_API, FRONTEND_URL } from '../env'

test.describe('Vision Leaderboard', () => {
  test('global leaderboard has players with non-zero PnL', async () => {
    const res = await fetch(`${VISION_API}/vision/leaderboard`, {
      signal: AbortSignal.timeout(10_000),
    })
    expect(res.ok).toBe(true)
    const data = await res.json()
    const lb = data.leaderboard ?? []
    console.log(`Global leaderboard: ${lb.length} players`)

    expect(lb.length).toBeGreaterThan(0)

    // At least 2 players should have non-zero PnL
    const nonZero = lb.filter((p: any) => Math.abs(p.pnl) > 0.001)
    console.log(`Non-zero PnL: ${nonZero.length} players`)
    for (const p of nonZero.slice(0, 5)) {
      console.log(`  ${p.walletAddress.slice(0, 12)}... pnl=${p.pnl.toFixed(2)} winRate=${p.winRate}%`)
    }
    expect(nonZero.length).toBeGreaterThanOrEqual(2)
  })

  test('per-source leaderboard returns data via frontend proxy', async () => {
    // Test via frontend proxy (same path the UI uses)
    const res = await fetch(`${FRONTEND_URL}/api/vision/leaderboard?source_id=defi`, {
      signal: AbortSignal.timeout(10_000),
    })
    expect(res.ok).toBe(true)
    const data = await res.json()
    const lb = data.leaderboard ?? []
    console.log(`Per-source (defi) leaderboard: ${lb.length} players`)

    // Should have players (even if all $0 for a dead source)
    expect(lb.length).toBeGreaterThan(0)
  })

  test('per-source leaderboard has non-zero PnL for active sources', async () => {
    // Find a source with active tick deltas by checking multiple
    const sources = ['defi', 'earthquake', 'iss', 'pumpfun', 'twitch']
    let bestSource = ''
    let bestNonZero = 0

    for (const src of sources) {
      const res = await fetch(`${VISION_API}/vision/leaderboard?source_id=${src}`, {
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) continue
      const data = await res.json()
      const lb = data.leaderboard ?? []
      const nz = lb.filter((p: any) => Math.abs(p.pnl) > 0.001).length
      console.log(`Source ${src}: ${lb.length} players, ${nz} non-zero`)
      if (nz > bestNonZero) {
        bestNonZero = nz
        bestSource = src
      }
    }

    console.log(`Best source: ${bestSource} with ${bestNonZero} non-zero players`)
    // At least one source should have non-zero PnL
    expect(bestNonZero).toBeGreaterThanOrEqual(1)
  })

  test('leaderboard source_id mapping works (coingecko → crypto)', async () => {
    // Frontend proxy should translate coingecko → crypto via toInternalId
    const res = await fetch(`${FRONTEND_URL}/api/vision/leaderboard?source_id=coingecko`, {
      signal: AbortSignal.timeout(10_000),
    })
    expect(res.ok).toBe(true)
    const data = await res.json()
    const lb = data.leaderboard ?? []
    console.log(`coingecko leaderboard: ${lb.length} players`)
    // Should return data (mapped to crypto internally)
    expect(lb.length).toBeGreaterThan(0)
  })
})
