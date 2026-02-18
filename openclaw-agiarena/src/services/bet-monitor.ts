/**
 * Bet monitoring service.
 *
 * Polls the backend for settlement status of active bets, computes
 * PnL when a bet settles, and triggers circuit-breaker evaluation.
 */

import type { ServiceDefinition, BetRecord } from '../types'
import type { ResearchStore } from '../research/store'
import type { BackendClient, BetSummary, BetTradesResponse, Resolution } from '../adapters/backend-client'
import type { CircuitBreaker } from '../safety/circuit-breaker'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 30_000

// ---------------------------------------------------------------------------
// PnL calculation
// ---------------------------------------------------------------------------

/**
 * Compute profit-and-loss for a settled bet.
 *
 * Uses the backend-provided winsCount and validTrades from BetTradesResponse.
 * winRate = winsCount / validTrades
 * PnL = stakeWind * (winRate > 0.5
 *     ? (winRate - 0.5) * 2 * oddsBps / 10000
 *     : -(0.5 - winRate) * 2)
 *
 * Returns 0 if there are no valid trades (edge case).
 */
function computePnl(
  stakeWind: number,
  oddsBps: number,
  tradesResponse: BetTradesResponse,
): number {
  const validTrades = tradesResponse.validTrades ?? tradesResponse.trades.length
  if (validTrades === 0) return 0

  // Backend provides winsCount directly; fall back to counting won=true trades
  const wins = tradesResponse.winsCount
    ?? tradesResponse.trades.filter((t) => t.won === true).length
  const winRate = wins / validTrades

  if (winRate > 0.5) {
    return stakeWind * (winRate - 0.5) * 2 * (oddsBps / 10_000)
  }

  return stakeWind * -((0.5 - winRate) * 2)
}

/**
 * Compute PnL from a resolution object.
 *
 * Handles cancelled (PnL=0), tied (PnL=0), won (+stake * odds), lost (-stake).
 * Uses `bet.action` to determine if we're creator or filler.
 */
function computePnlFromResolution(
  bet: BetRecord,
  resolution: Resolution,
): number {
  if (resolution.isCancelled) return 0
  if (resolution.isTie) return 0

  const isCreator = bet.action === 'place'
  const creatorWins = resolution.creatorWins ?? false
  const won = isCreator ? creatorWins : !creatorWins

  if (won) {
    return bet.stakeWind * (bet.oddsBps / 10_000)
  }
  return -bet.stakeWind
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBetMonitor(
  store: ResearchStore,
  backend: BackendClient,
  circuitBreaker: CircuitBreaker,
  onSettled?: (bet: BetRecord) => void,
): ServiceDefinition {
  let intervalHandle: ReturnType<typeof setInterval> | null = null

  /**
   * Check a single active bet against pre-fetched settled bets and settle
   * it if the backend reports it as settled.
   */
  async function checkBet(bet: BetRecord, settledBets: BetSummary[]): Promise<void> {
    const label = `[bet-monitor] bet=${bet.id}`

    const settled = settledBets.find((b) => b.betId === bet.betId)
    if (!settled) return // Not yet settled

    // Try resolution-based PnL first, fall back to trades-based
    let pnl: number
    try {
      const resolution = await backend.getResolution(bet.betId)
      pnl = computePnlFromResolution(bet, resolution)
    } catch {
      const tradesResponse = await backend.getBetTrades(bet.betId)
      pnl = computePnl(bet.stakeWind, bet.oddsBps, tradesResponse)
    }

    store.updateBetStatus(bet.id, 'settled', pnl)

    console.log(
      `${label} Settled: pnl=${pnl.toFixed(4)} WIND`,
    )

    // Let the circuit breaker re-evaluate after every settlement
    circuitBreaker.evaluate()

    onSettled?.({
      ...bet,
      status: 'settled',
      pnl,
      settledAt: Date.now(),
    })
  }

  /**
   * Single polling tick: find all active bets and check each one.
   */
  async function tick(): Promise<void> {
    // Kill switch check
    const killSwitch = store.getKillSwitch()
    if (killSwitch.active) {
      console.log('[bet-monitor] Kill switch active, skipping tick')
      return
    }

    const activeBets = store.getBets({ status: 'active' })

    if (activeBets.length === 0) return

    console.log(
      `[bet-monitor] Checking ${activeBets.length} active bet(s)`,
    )

    // Fetch settled bets once for the whole tick (avoids N+1 queries)
    const settledBets = await backend.getBets({ status: 'settled' })

    for (const bet of activeBets) {
      try {
        await checkBet(bet, settledBets)
      } catch (err) {
        console.error(
          `[bet-monitor] Error checking bet=${bet.id}:`,
          err instanceof Error ? err.message : String(err),
        )
      }
    }
  }

  // -------------------------------------------------------------------------
  // ServiceDefinition
  // -------------------------------------------------------------------------

  return {
    name: 'bet-monitor',

    async start(): Promise<void> {
      console.log(
        `[bet-monitor] Starting (poll=${POLL_INTERVAL_MS}ms)`,
      )

      // Run an initial tick immediately
      await tick()

      intervalHandle = setInterval(() => {
        void tick()
      }, POLL_INTERVAL_MS)
    },

    async stop(): Promise<void> {
      console.log('[bet-monitor] Stopping')
      if (intervalHandle !== null) {
        clearInterval(intervalHandle)
        intervalHandle = null
      }
    },
  }
}
