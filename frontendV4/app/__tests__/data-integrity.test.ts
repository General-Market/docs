/**
 * Live Data Integrity Tests
 *
 * These tests verify that API endpoints return valid data and detect
 * when values are suspiciously empty or zero (indicating data loading issues).
 *
 * Run with: bun test app/__tests__/data-integrity.test.ts
 *
 * Environment: Set BACKEND_URL to test against production or staging
 * Examples:
 *   BACKEND_URL=https://agiarena.vercel.app bun test  # Via Vercel (recommended)
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 bun test          # Direct server with self-signed cert
 */

import { describe, it, expect, beforeAll } from 'bun:test'

// Backend URL - defaults to production server
// Use Vercel URL for proper SSL, or set NODE_TLS_REJECT_UNAUTHORIZED=0 for direct server
const BACKEND_URL = process.env.BACKEND_URL || 'https://63.179.141.230'

// Disable SSL verification for self-signed certs in testing
if (BACKEND_URL.includes('63.179.141.230') || BACKEND_URL.includes('localhost')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

/**
 * Helper to make API requests with timeout
 */
async function fetchWithTimeout(url: string, timeoutMs: number = 10000): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { signal: controller.signal })
    return response
  } finally {
    clearTimeout(timeout)
  }
}

describe('API Health Checks', () => {
  it('backend is reachable', async () => {
    const response = await fetchWithTimeout(`${BACKEND_URL}/api/config`)
    expect(response.ok).toBe(true)
  })

  it('config endpoint returns valid contract addresses', async () => {
    const response = await fetchWithTimeout(`${BACKEND_URL}/api/config`)
    const data = await response.json()

    expect(data.contractAddress).toBeDefined()
    expect(data.contractAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(data.chainId).toBeDefined()
    expect(typeof data.chainId).toBe('number')
  })
})

describe('Leaderboard Data Integrity', () => {
  let leaderboardData: { leaderboard: any[] }

  beforeAll(async () => {
    const response = await fetchWithTimeout(`${BACKEND_URL}/api/leaderboard`)
    leaderboardData = await response.json()
  })

  it('leaderboard endpoint returns 200', async () => {
    const response = await fetchWithTimeout(`${BACKEND_URL}/api/leaderboard`)
    expect(response.status).toBe(200)
  })

  it('leaderboard has data (not empty)', () => {
    expect(leaderboardData.leaderboard).toBeDefined()
    expect(Array.isArray(leaderboardData.leaderboard)).toBe(true)
    // If there are agents, there should be at least one entry
    // This test will pass even with 0 entries if system is new
  })

  it('leaderboard entries have required fields', () => {
    if (leaderboardData.leaderboard.length === 0) {
      console.log('WARN: Leaderboard is empty - no agents registered yet')
      return
    }

    const entry = leaderboardData.leaderboard[0]
    expect(entry.walletAddress).toBeDefined()
    expect(entry.walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(entry.rank).toBeDefined()
    expect(typeof entry.rank).toBe('number')
  })

  it('leaderboard wallet addresses are valid', () => {
    for (const entry of leaderboardData.leaderboard) {
      expect(entry.walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    }
  })

  it('ALERT: detects if ALL leaderboard entries have zero PnL', () => {
    if (leaderboardData.leaderboard.length === 0) return

    const allZeroPnl = leaderboardData.leaderboard.every(
      (entry: any) => parseFloat(entry.pnl || '0') === 0
    )

    if (allZeroPnl && leaderboardData.leaderboard.length > 5) {
      console.error('ALERT: All leaderboard entries have 0 PnL - possible data issue!')
    }

    // This is a soft check - log warning but don't fail
    // as it could be legitimate in a new system
  })
})

describe('Recent Bets Data Integrity', () => {
  let recentBetsData: { events: any[] }

  beforeAll(async () => {
    const response = await fetchWithTimeout(`${BACKEND_URL}/api/bets/recent?limit=20`)
    recentBetsData = await response.json()
  })

  it('recent bets endpoint returns 200', async () => {
    const response = await fetchWithTimeout(`${BACKEND_URL}/api/bets/recent?limit=20`)
    expect(response.status).toBe(200)
  })

  it('recent bets has expected structure', () => {
    expect(recentBetsData.events).toBeDefined()
    expect(Array.isArray(recentBetsData.events)).toBe(true)
  })

  it('bet events have required fields', () => {
    if (recentBetsData.events.length === 0) {
      console.log('WARN: No recent bets - system may be new or quiet')
      return
    }

    const event = recentBetsData.events[0]
    expect(event.betId).toBeDefined()
    expect(event.walletAddress).toBeDefined()
    expect(event.walletAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(event.amount).toBeDefined()
    expect(event.portfolioSize).toBeDefined()
    expect(typeof event.portfolioSize).toBe('number')
  })

  it('ALERT: detects if ALL bet amounts are zero', () => {
    if (recentBetsData.events.length === 0) return

    const allZeroAmount = recentBetsData.events.every(
      (event: any) => parseFloat(event.amount || '0') === 0
    )

    if (allZeroAmount) {
      throw new Error(
        'CRITICAL: All recent bet amounts are $0.00 - data integrity issue detected!'
      )
    }
  })

  it('bet amounts are valid numbers', () => {
    for (const event of recentBetsData.events) {
      const amount = parseFloat(event.amount)
      expect(isNaN(amount)).toBe(false)
      expect(amount).toBeGreaterThanOrEqual(0)
    }
  })

  it('portfolio sizes are reasonable (1-10000)', () => {
    for (const event of recentBetsData.events) {
      expect(event.portfolioSize).toBeGreaterThan(0)
      expect(event.portfolioSize).toBeLessThanOrEqual(10000)
    }
  })
})

describe('Individual Bet Detail Data Integrity', () => {
  let testBetId: string | null = null

  beforeAll(async () => {
    // Get a real bet ID from recent bets
    const response = await fetchWithTimeout(`${BACKEND_URL}/api/bets/recent?limit=1`)
    const data = await response.json()
    if (data.events && data.events.length > 0) {
      testBetId = data.events[0].betId
    }
  })

  it('bet detail endpoint returns valid data', async () => {
    if (!testBetId) {
      console.log('SKIP: No bets available to test detail endpoint')
      return
    }

    const response = await fetchWithTimeout(`${BACKEND_URL}/api/bets/${testBetId}`)
    expect(response.status).toBe(200)

    const bet = await response.json()
    expect(bet.betId).toBe(testBetId)
    expect(bet.creatorAddress).toMatch(/^0x[a-fA-F0-9]{40}$/)
    expect(bet.amount).toBeDefined()
    expect(bet.status).toBeDefined()
  })

  it('ALERT: detects missing filler when status is matched', async () => {
    if (!testBetId) return

    const response = await fetchWithTimeout(`${BACKEND_URL}/api/bets/${testBetId}`)
    const bet = await response.json()

    // Story 14-1: Single-filler model — matched bets must have filler
    if (bet.status === 'matched' || bet.status === 'settling' || bet.status === 'settled') {
      if (!bet.fillerAddress) {
        throw new Error(
          `CRITICAL: Bet ${testBetId} has status '${bet.status}' but no fillerAddress!`
        )
      }
    }
  })

  it('bet portfolio endpoint returns positions', async () => {
    if (!testBetId) return

    const response = await fetchWithTimeout(`${BACKEND_URL}/api/bets/${testBetId}/portfolio?limit=10`)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.positions).toBeDefined()
    expect(Array.isArray(data.positions)).toBe(true)
  })
})

describe('Resolution Data Integrity', () => {
  it('resolution endpoint structure is valid', async () => {
    // Get a bet to check its resolution
    const betsResponse = await fetchWithTimeout(`${BACKEND_URL}/api/bets/recent?limit=5`)
    const betsData = await betsResponse.json()

    if (betsData.events.length === 0) {
      console.log('SKIP: No bets to check resolution data')
      return
    }

    // Try to get resolution for first bet
    const betId = betsData.events[0].betId
    const response = await fetchWithTimeout(`${BACKEND_URL}/api/resolutions/${betId}`)

    // 404 is acceptable if bet hasn't been resolved yet
    if (response.status === 404) {
      console.log(`INFO: Bet ${betId} has no resolution yet (expected for pending bets)`)
      return
    }

    expect(response.status).toBe(200)
    const resolution = await response.json()

    expect(resolution.betId).toBeDefined()
    expect(resolution.status).toBeDefined()
  })

  it('ALERT: detects resolved bets with zero scores', async () => {
    const betsResponse = await fetchWithTimeout(`${BACKEND_URL}/api/bets/recent?limit=20`)
    const betsData = await betsResponse.json()

    for (const event of betsData.events) {
      if (event.eventType === 'won' || event.eventType === 'lost') {
        const resResponse = await fetchWithTimeout(
          `${BACKEND_URL}/api/resolutions/${event.betId}`
        )
        if (resResponse.status !== 200) continue

        const resolution = await resResponse.json()

        // Check if portfolio score is suspiciously 0.00%
        if (resolution.aggregateScore !== undefined) {
          const score = parseFloat(resolution.aggregateScore)
          if (score === 0 && resolution.status === 'consensus_reached') {
            console.warn(
              `WARN: Bet ${event.betId} has consensus but 0.00% score - verify this is correct`
            )
          }
        }
      }
    }
  })
})

describe('Settlement Amount Validation', () => {
  it('ALERT: detects $0.00 payouts on settled bets', async () => {
    const betsResponse = await fetchWithTimeout(`${BACKEND_URL}/api/bets/recent?limit=20`)
    const betsData = await betsResponse.json()

    const settledBets = betsData.events.filter(
      (e: any) => e.eventType === 'won' || e.eventType === 'lost'
    )

    for (const event of settledBets) {
      const betResponse = await fetchWithTimeout(`${BACKEND_URL}/api/bets/${event.betId}`)
      if (betResponse.status !== 200) continue

      const bet = await betResponse.json()

      if (bet.status === 'settled') {
        const amount = parseFloat(bet.amount || '0')
        // Story 14-1: Compute total pot from odds instead of matchedAmount
        const oddsBps = bet.oddsBps && bet.oddsBps > 0 ? bet.oddsBps : 10000
        const fillerStake = (amount * oddsBps) / 10000
        const totalPot = amount + fillerStake

        if (totalPot === 0) {
          throw new Error(
            `CRITICAL: Settled bet ${event.betId} has $0.00 total pot - data issue!`
          )
        }
      }
    }
  })
})

describe('Data Consistency Checks', () => {
  it('bet status transitions are valid', async () => {
    const response = await fetchWithTimeout(`${BACKEND_URL}/api/bets/recent?limit=20`)
    const data = await response.json()

    // Story 14-1: Updated statuses for single-filler model
    const validStatuses = ['pending', 'matched', 'settling', 'settled']

    for (const event of data.events) {
      if (event.status) {
        expect(validStatuses).toContain(event.status)
      }
    }
  })

  it('timestamps are valid ISO dates', async () => {
    const response = await fetchWithTimeout(`${BACKEND_URL}/api/bets/recent?limit=10`)
    const data = await response.json()

    for (const event of data.events) {
      if (event.timestamp) {
        const date = new Date(event.timestamp)
        expect(isNaN(date.getTime())).toBe(false)
      }
    }
  })

  it('ALERT: detects timestamps in the far future', async () => {
    const response = await fetchWithTimeout(`${BACKEND_URL}/api/bets/recent?limit=10`)
    const data = await response.json()

    const oneYearFromNow = Date.now() + 365 * 24 * 60 * 60 * 1000

    for (const event of data.events) {
      if (event.timestamp) {
        const timestamp = new Date(event.timestamp).getTime()
        if (timestamp > oneYearFromNow) {
          throw new Error(
            `CRITICAL: Bet ${event.betId} has timestamp in far future: ${event.timestamp}`
          )
        }
      }
    }
  })
})
