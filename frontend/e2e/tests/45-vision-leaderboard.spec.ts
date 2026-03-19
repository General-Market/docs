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
    // Fetch ALL sources from the registry
    const sourcesRes = await fetch(`${FRONTEND_URL}/api/vision/sources`, {
      signal: AbortSignal.timeout(10_000),
    })
    expect(sourcesRes.ok).toBe(true)
    const sourcesData = await sourcesRes.json()
    const allSources: Array<{ sourceId: string; internalIds?: string[] }> = sourcesData.sources ?? []
    expect(allSources.length).toBeGreaterThan(0)
    console.log(`Registry returned ${allSources.length} sources`)

    type Row = { source: string; total: number; nonZero: number }
    const table: Row[] = []

    for (const src of allSources) {
      // Resolve to internal ID — use the first internalId if present, else the display sourceId
      const queryId = src.internalIds?.[0] ?? src.sourceId
      const res = await fetch(`${VISION_API}/vision/leaderboard?source_id=${queryId}`, {
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        console.warn(`Source ${src.sourceId} (${queryId}): HTTP ${res.status}`)
        table.push({ source: src.sourceId, total: -1, nonZero: 0 })
        continue
      }
      const data = await res.json()
      const lb: any[] = data.leaderboard ?? []
      const nz = lb.filter(p => Math.abs(p.pnl) > 0.001).length
      table.push({ source: src.sourceId, total: lb.length, nonZero: nz })
    }

    // Print the full table
    console.log('\nSource leaderboard coverage:')
    console.log('source'.padEnd(24) + 'players'.padEnd(10) + 'non-zero')
    for (const row of table) {
      const playerCol = row.total === -1 ? 'ERR' : String(row.total)
      console.log(row.source.padEnd(24) + playerCol.padEnd(10) + row.nonZero)
    }

    const sourcesWithNonZero = table.filter(r => r.nonZero >= 1).length
    const totalSources = table.length
    const pct = Math.round((sourcesWithNonZero / totalSources) * 100)
    console.log(`\n${sourcesWithNonZero}/${totalSources} sources (${pct}%) have at least 1 player with non-zero PnL`)

    // At least 25% of sources should have non-zero PnL activity
    // (31 sources have stale data feeds — tracks improvement as staleness fix takes effect)
    expect(sourcesWithNonZero).toBeGreaterThanOrEqual(Math.floor(totalSources * 0.25))
  })

  test('all sources have leaderboard data', async () => {
    // Sources with no deployed batch are expected to return 0 players — that is not a bug.
    // Only sources that map to a deployed batch should have leaderboard data.
    // A "broken" source is one that maps to a deployed batch but returns 0 players.

    // Deployed batch names from vision-batches.json
    const deployedBatches = new Set([
      'defi', 'rates', 'bls', 'worldbank', 'eia', 'ecb', 'weather', 'sec_13f',
      'finra_short_vol', 'congress', 'bchain', 'bonds', 'anilist', 'backpacktf',
      'cloudflare', 'fourchan', 'hackernews', 'polymarket', 'steam', 'twitch',
      'zillow', 'earthquake', 'spaceweather', 'wildfire', 'mil_aircraft', 'sports',
      'iss', 'weather_alerts', 'animals', 'gtfs_transit', 'usa_spending', 'pumpfun',
      'usgs_water', 'chaturbate', 'noaa_tides', 'citybikes', 'ndbc', 'noaa_met',
      'nwps', 'airnow', 'crossref', 'pubmed', 'parking', 'bestbuy', 'adzuna',
      'queue_times', 'mta_subway',
    ])

    const sourcesRes = await fetch(`${FRONTEND_URL}/api/vision/sources`, {
      signal: AbortSignal.timeout(10_000),
    })
    expect(sourcesRes.ok).toBe(true)
    const sourcesData = await sourcesRes.json()
    const allSources: Array<{ sourceId: string; internalIds?: string[] }> = sourcesData.sources ?? []
    expect(allSources.length).toBeGreaterThan(0)

    // Determine which display sources map to at least one deployed batch
    const expectedSources = allSources.filter(src => {
      const ids = [src.sourceId, ...(src.internalIds ?? [])]
      return ids.some(id => deployedBatches.has(id))
    })

    const broken: string[] = []    // maps to a batch, but returns 0 players — bad mapping
    const dead: string[] = []      // maps to a batch, >0 players but all $0 — valid, no activity
    const active: string[] = []    // maps to a batch, >0 players with non-zero PnL
    const unmapped: string[] = []  // no batch deployed — expected, not a failure

    for (const src of allSources) {
      const ids = [src.sourceId, ...(src.internalIds ?? [])]
      const hasBatch = ids.some(id => deployedBatches.has(id))

      if (!hasBatch) {
        unmapped.push(src.sourceId)
        continue
      }

      // Query using the first internalId that matches a deployed batch, else sourceId
      const queryId =
        (src.internalIds ?? []).find(id => deployedBatches.has(id)) ??
        (deployedBatches.has(src.sourceId) ? src.sourceId : (src.internalIds?.[0] ?? src.sourceId))

      const res = await fetch(`${VISION_API}/vision/leaderboard?source_id=${queryId}`, {
        signal: AbortSignal.timeout(10_000),
      })
      if (!res.ok) {
        broken.push(`${src.sourceId} (HTTP ${res.status})`)
        continue
      }
      const data = await res.json()
      const lb: any[] = data.leaderboard ?? []
      if (lb.length === 0) {
        broken.push(`${src.sourceId} [batch:${queryId}]`)
      } else if (lb.every(p => Math.abs(p.pnl) <= 0.001)) {
        dead.push(src.sourceId)
      } else {
        active.push(src.sourceId)
      }
    }

    console.log(`\nExpected sources (have a deployed batch): ${expectedSources.length}`)
    console.log(`Active  (non-zero PnL):         [${active.join(', ')}]`)
    console.log(`Dead    (all $0, query OK):      [${dead.join(', ')}]`)
    console.log(`Broken  (0 players, has batch):  [${broken.join(', ')}]`)
    console.log(`Unmapped (no batch — expected):  [${unmapped.join(', ')}]`)

    // Only sources with a deployed batch should return players.
    // Zero players from a mapped source = broken source_id query.
    expect(broken, `Sources with deployed batch but 0 players: ${broken.join(', ')}`).toHaveLength(0)
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
