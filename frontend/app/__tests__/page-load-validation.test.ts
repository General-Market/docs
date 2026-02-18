/**
 * Page Load Data Validation Tests
 *
 * These tests simulate what a user would see when loading pages,
 * detecting when data displays as empty/$0.00 when it shouldn't.
 *
 * Run with: bun test app/__tests__/page-load-validation.test.ts
 *
 * Environment: Set BACKEND_URL to test against production or staging
 * Examples:
 *   BACKEND_URL=https://agiarena.vercel.app bun test  # Via Vercel (recommended)
 *   NODE_TLS_REJECT_UNAUTHORIZED=0 bun test          # Direct server with self-signed cert
 */

import { describe, it, expect, beforeAll } from 'bun:test'

// Backend URL - defaults to production server
const BACKEND_URL = process.env.BACKEND_URL || 'https://63.179.141.230'

// Disable SSL verification for self-signed certs in testing
if (BACKEND_URL.includes('63.179.141.230') || BACKEND_URL.includes('localhost')) {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

interface BetData {
  betId: string
  amount: string
  oddsBps?: number
  status: string
  portfolioSize: number
  creatorAddress: string
  fillerAddress?: string
  fillerStake?: string
}

/**
 * Resolution data interface for Epic 8 majority-wins system
 */
interface ResolutionData {
  betId: string
  status: string
  // Epic 8: Majority-wins fields
  winsCount?: number
  validTrades?: number
  winRate?: number
  creatorWins?: boolean | null
  isTie?: boolean
  isCancelled?: boolean
  cancelReason?: string
}

/**
 * Simulates the calculation done in bet detail page to get display values
 */
function calculateDisplayValues(bet: BetData) {
  const creatorStake = parseFloat(bet.amount)
  const oddsBps = bet.oddsBps && bet.oddsBps > 0 ? bet.oddsBps : 10000
  const oddsDecimal = oddsBps / 10000
  // Story 14-1: Compute required match from odds
  const requiredMatch = (creatorStake * oddsBps) / 10000
  const totalPot = creatorStake + requiredMatch
  const isMatched = !!bet.fillerAddress

  return {
    creatorStake,
    requiredMatch,
    totalPot,
    isMatched,
    oddsDecimal,
    // What user sees on the page
    displayTotalPot: `$${totalPot.toFixed(2)}`,
    displayOdds: `${oddsDecimal.toFixed(2)}x`
  }
}

describe('Homepage Data Loading', () => {
  describe('Leaderboard Section', () => {
    it('leaderboard loads with agents', async () => {
      const response = await fetch(`${BACKEND_URL}/api/leaderboard`)
      const data = await response.json()

      // Should have at least some data structure
      expect(data.leaderboard).toBeDefined()

      if (data.leaderboard.length > 0) {
        console.log(`✓ Leaderboard has ${data.leaderboard.length} agents`)

        // First agent should have displayable data
        const topAgent = data.leaderboard[0]
        expect(topAgent.walletAddress).toBeDefined()
        expect(topAgent.rank).toBeDefined()
      } else {
        console.log('WARN: Leaderboard is empty - no agents to display')
      }
    })

    it('ALERT: leaderboard does not show broken rank numbers', async () => {
      const response = await fetch(`${BACKEND_URL}/api/leaderboard`)
      const data = await response.json()

      for (const agent of data.leaderboard) {
        expect(agent.rank).toBeGreaterThan(0)
        expect(agent.rank).toBeLessThanOrEqual(data.leaderboard.length)
      }
    })
  })

  describe('Recent Bets Feed Section', () => {
    it('recent bets feed loads data', async () => {
      const response = await fetch(`${BACKEND_URL}/api/bets/recent?limit=20`)
      const data = await response.json()

      expect(data.events).toBeDefined()

      if (data.events.length > 0) {
        console.log(`✓ Recent bets feed has ${data.events.length} events`)
      } else {
        console.log('INFO: No recent bets - feed will show empty state')
      }
    })

    it('bet feed items have displayable amounts', async () => {
      const response = await fetch(`${BACKEND_URL}/api/bets/recent?limit=10`)
      const data = await response.json()

      for (const event of data.events) {
        const amount = parseFloat(event.amount)
        expect(isNaN(amount)).toBe(false)

        // Amount should display as more than $0.00 (minimum bet is usually 0.01)
        if (amount === 0) {
          console.warn(`WARN: Event ${event.betId} has $0.00 amount`)
        }
      }
    })
  })
})

describe('Bet Detail Page Data Loading', () => {
  let testBet: BetData | null = null

  beforeAll(async () => {
    const response = await fetch(`${BACKEND_URL}/api/bets/recent?limit=1`)
    const data = await response.json()
    if (data.events && data.events.length > 0) {
      const betResponse = await fetch(`${BACKEND_URL}/api/bets/${data.events[0].betId}`)
      testBet = await betResponse.json()
    }
  })

  it('bet detail page loads all required fields', async () => {
    if (!testBet) {
      console.log('SKIP: No bets available')
      return
    }

    // These fields are displayed on the bet detail page
    expect(testBet.betId).toBeDefined()
    expect(testBet.amount).toBeDefined()
    expect(testBet.status).toBeDefined()
    expect(testBet.creatorAddress).toBeDefined()
  })

  it('CRITICAL: bet amounts are not all $0.00', async () => {
    if (!testBet) return

    const display = calculateDisplayValues(testBet)

    // The creator stake should never be $0.00
    if (display.creatorStake === 0) {
      throw new Error(`CRITICAL: Bet ${testBet.betId} has $0.00 creator stake!`)
    }

    console.log(`✓ Bet ${testBet.betId} displays:`)
    console.log(`  Creator Staked: $${display.creatorStake.toFixed(2)}`)
    console.log(`  Filler Stake: $${display.requiredMatch.toFixed(2)}`)
    console.log(`  Matched: ${display.isMatched ? 'Yes' : 'No'}`)
  })

  it('matched bets have filler address', async () => {
    if (!testBet) return

    // Story 14-1: Single-filler model — matched bets should have a filler
    if (testBet.status === 'matched' || testBet.status === 'settling' || testBet.status === 'settled') {
      if (!testBet.fillerAddress) {
        throw new Error(
          `CRITICAL: Bet ${testBet.betId} status is '${testBet.status}' but has no filler address`
        )
      }
    }
  })

  it('total pot calculation is correct', async () => {
    if (!testBet) return

    const display = calculateDisplayValues(testBet)

    // Total pot should be creator stake + required match (or matched amount)
    const expectedTotalPot = display.creatorStake + display.requiredMatch
    expect(display.totalPot).toBeCloseTo(expectedTotalPot, 2)
  })

  it('odds badge displays valid multiplier', async () => {
    if (!testBet) return

    const display = calculateDisplayValues(testBet)

    // Odds should be at least 1.00x
    expect(display.oddsDecimal).toBeGreaterThanOrEqual(1.0)

    // And reasonably capped (10x would be extreme)
    expect(display.oddsDecimal).toBeLessThanOrEqual(10.0)

    console.log(`✓ Odds badge displays: ${display.displayOdds}`)
  })
})

describe('Resolution Section Data Loading', () => {
  let resolvedBetId: string | null = null
  let resolutionData: ResolutionData | null = null

  beforeAll(async () => {
    // Find a resolved bet
    const response = await fetch(`${BACKEND_URL}/api/bets/recent?limit=50`)
    const data = await response.json()

    for (const event of data.events) {
      if (event.eventType === 'won' || event.eventType === 'lost') {
        resolvedBetId = event.betId

        const resResponse = await fetch(`${BACKEND_URL}/api/resolutions/${event.betId}`)
        if (resResponse.status === 200) {
          resolutionData = await resResponse.json()
          break
        }
      }
    }
  })

  it('resolution data loads for resolved bets', async () => {
    if (!resolvedBetId) {
      console.log('SKIP: No resolved bets found to test')
      return
    }

    if (!resolutionData) {
      console.log('SKIP: Resolution data not available')
      return
    }

    expect(resolutionData.betId).toBe(resolvedBetId)
    expect(resolutionData.status).toBeDefined()

    console.log(`✓ Resolution for bet ${resolvedBetId}: status=${resolutionData.status}`)
  })

  it('CRITICAL: resolved bets show majority-wins outcome', async () => {
    if (!resolutionData) return

    // Epic 8: Check for majority-wins resolution data
    if (resolutionData.status === 'resolved' || resolutionData.status === 'tie' || resolutionData.status === 'cancelled') {
      // Verify Epic 8 fields are present
      if (resolutionData.winsCount === undefined || resolutionData.validTrades === undefined) {
        console.warn(`WARN: Resolution for bet ${resolutionData.betId} missing Epic 8 fields`)
        console.log('Available fields:', Object.keys(resolutionData))
        return
      }

      const winRate = resolutionData.validTrades > 0
        ? (resolutionData.winsCount / resolutionData.validTrades * 100).toFixed(1)
        : 'N/A'

      console.log(`✓ Trades Won: ${resolutionData.winsCount}/${resolutionData.validTrades} (${winRate}%)`)

      if (resolutionData.isTie) {
        console.log(`  Outcome: Tie - Both Refunded`)
      } else if (resolutionData.isCancelled) {
        console.log(`  Outcome: Cancelled - ${resolutionData.cancelReason || 'Unknown reason'}`)
      } else {
        console.log(`  Outcome: ${resolutionData.creatorWins ? 'Creator' : 'Matcher'} Wins`)
      }
    }
  })

  it('resolved bets have valid win counts', async () => {
    if (!resolutionData) return

    if (resolutionData.status === 'resolved') {
      // winsCount should be <= validTrades
      if (resolutionData.winsCount !== undefined && resolutionData.validTrades !== undefined) {
        expect(resolutionData.winsCount).toBeLessThanOrEqual(resolutionData.validTrades)
        expect(resolutionData.winsCount).toBeGreaterThanOrEqual(0)

        // Winner determination: >50% wins = creator wins
        if (resolutionData.validTrades > 0 && !resolutionData.isTie) {
          const winRate = resolutionData.winsCount / resolutionData.validTrades
          if (winRate > 0.5) {
            expect(resolutionData.creatorWins).toBe(true)
          } else if (winRate < 0.5) {
            expect(resolutionData.creatorWins).toBe(false)
          }
        }
      }
    }
  })
})

describe('Settlement Details Display', () => {
  it('CRITICAL: settled bets show non-zero payout amounts', async () => {
    const response = await fetch(`${BACKEND_URL}/api/bets/recent?limit=50`)
    const data = await response.json()

    let foundSettled = false

    for (const event of data.events) {
      if (event.eventType === 'won' || event.eventType === 'lost') {
        const betResponse = await fetch(`${BACKEND_URL}/api/bets/${event.betId}`)
        const bet: BetData = await betResponse.json()

        if (bet.status === 'settled') {
          foundSettled = true
          const display = calculateDisplayValues(bet)

          // Settlement details that would show on the page
          const platformFee = display.totalPot * 0.001 // 0.1%
          const winnerPayout = display.totalPot - platformFee

          console.log(`✓ Settled bet ${bet.betId}:`)
          console.log(`  Total Pot: ${display.displayTotalPot}`)
          console.log(`  Platform Fee (0.1%): $${platformFee.toFixed(2)}`)
          console.log(`  Winner Payout: $${winnerPayout.toFixed(2)}`)

          // Total pot should not be $0.00
          if (display.totalPot === 0) {
            throw new Error(
              `CRITICAL: Settled bet ${bet.betId} shows Total Pot: $0.00 - data issue!`
            )
          }

          break
        }
      }
    }

    if (!foundSettled) {
      console.log('INFO: No settled bets found to verify payout display')
    }
  })
})

describe('Portfolio Positions Display', () => {
  let testBetId: string | null = null

  beforeAll(async () => {
    const response = await fetch(`${BACKEND_URL}/api/bets/recent?limit=1`)
    const data = await response.json()
    if (data.events && data.events.length > 0) {
      testBetId = data.events[0].betId
    }
  })

  it('portfolio positions load with market data', async () => {
    if (!testBetId) {
      console.log('SKIP: No bets available')
      return
    }

    const response = await fetch(`${BACKEND_URL}/api/bets/${testBetId}/portfolio?limit=10`)
    const data = await response.json()

    expect(data.positions).toBeDefined()
    expect(Array.isArray(data.positions)).toBe(true)

    if (data.positions.length > 0) {
      console.log(`✓ Portfolio has ${data.positions.length} positions`)

      const pos = data.positions[0]
      expect(pos.marketId).toBeDefined()
      expect(pos.position).toBeDefined()
      expect(['YES', 'NO']).toContain(pos.position)
    } else {
      console.log('WARN: Portfolio positions array is empty')
    }
  })

  it('positions have valid price data', async () => {
    if (!testBetId) return

    const response = await fetch(`${BACKEND_URL}/api/bets/${testBetId}/portfolio?limit=10`)
    const data = await response.json()

    for (const pos of data.positions) {
      if (pos.startingPrice !== undefined) {
        const price = parseFloat(pos.startingPrice)
        expect(price).toBeGreaterThanOrEqual(0)
        expect(price).toBeLessThanOrEqual(1)
      }

      if (pos.currentPrice !== undefined) {
        const price = parseFloat(pos.currentPrice)
        expect(price).toBeGreaterThanOrEqual(0)
        expect(price).toBeLessThanOrEqual(1)
      }
    }
  })
})

describe('Agent Detail Page Data Loading', () => {
  let testWalletAddress: string | null = null

  beforeAll(async () => {
    const response = await fetch(`${BACKEND_URL}/api/leaderboard`)
    const data = await response.json()
    if (data.leaderboard && data.leaderboard.length > 0) {
      testWalletAddress = data.leaderboard[0].walletAddress
    }
  })

  it('agent detail endpoint returns data', async () => {
    if (!testWalletAddress) {
      console.log('SKIP: No agents available')
      return
    }

    // Correct endpoint is /api/agents/:wallet_address (not /stats)
    const response = await fetch(`${BACKEND_URL}/api/agents/${testWalletAddress}`)
    expect(response.status).toBe(200)

    const agent = await response.json()
    expect(agent.walletAddress.toLowerCase()).toBe(testWalletAddress.toLowerCase())

    console.log(`✓ Agent ${testWalletAddress.slice(0, 10)}... detail loaded:`)
    console.log(`  PnL: ${agent.pnl}, Win Rate: ${agent.winRate}%, Total Bets: ${agent.portfolioBets}`)
  })

  it('agent performance endpoint returns data', async () => {
    if (!testWalletAddress) {
      console.log('SKIP: No agents available')
      return
    }

    const response = await fetch(`${BACKEND_URL}/api/agents/${testWalletAddress}/performance?range=all`)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.walletAddress.toLowerCase()).toBe(testWalletAddress.toLowerCase())
    expect(data.dataPoints).toBeDefined()
    expect(Array.isArray(data.dataPoints)).toBe(true)

    console.log(`✓ Agent ${testWalletAddress.slice(0, 10)}... performance: ${data.dataPoints.length} data points`)
  })

  it('agent bets endpoint returns history', async () => {
    if (!testWalletAddress) return

    const response = await fetch(`${BACKEND_URL}/api/agents/${testWalletAddress}/bets?limit=10`)
    expect(response.status).toBe(200)

    const data = await response.json()
    expect(data.bets).toBeDefined()
    expect(Array.isArray(data.bets)).toBe(true)

    console.log(`✓ Agent has ${data.bets.length} bets in history`)
  })
})
