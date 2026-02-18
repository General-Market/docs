/**
 * Bet execution service.
 *
 * Polls the store for approved pending bets and executes them on-chain
 * (or simulates execution in dry-run mode). Each bet passes through
 * safety checks (capital limiter, circuit breaker, kill switch) before
 * any on-chain interaction.
 */

import type {
  ServiceDefinition,
  PendingBet,
  BetRecord,
  PortfolioPosition,
} from '../types'
import type { ResearchStore } from '../research/store'
import type { ChainBridge } from '../adapters/chain-bridge'
import { computeBetHash } from '../adapters/chain-bridge'
import type { CapitalLimiter } from '../safety/capital-limiter'
import type { CircuitBreaker } from '../safety/circuit-breaker'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 5_000
const WIND_DECIMALS = 18

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createBetExecutor(
  store: ResearchStore,
  chain: ChainBridge,
  capitalLimiter: CapitalLimiter,
  circuitBreaker: CircuitBreaker,
  config: { dryRun: boolean },
  onExecuted?: (bet: BetRecord) => void,
): ServiceDefinition {
  let intervalHandle: ReturnType<typeof setInterval> | null = null
  let stopping = false

  /**
   * Convert a WIND amount (floating point) to its on-chain bigint
   * representation with 18 decimals.
   */
  function stakeToBigInt(stakeWind: number): bigint {
    // String-based conversion to avoid floating-point precision loss.
    // Split on decimal, pad fractional part to 18 digits, concatenate.
    const str = stakeWind.toString()
    const dotIdx = str.indexOf('.')

    let whole: string
    let frac: string

    if (dotIdx === -1) {
      whole = str
      frac = ''
    } else {
      whole = str.slice(0, dotIdx)
      frac = str.slice(dotIdx + 1)
    }

    if (frac.length > WIND_DECIMALS) {
      frac = frac.slice(0, WIND_DECIMALS)
    }

    frac = frac.padEnd(WIND_DECIMALS, '0')
    return BigInt(whole + frac)
  }

  /**
   * Build the positions array used for bet-hash computation from a
   * pending bet's portfolio.
   */
  function extractPositions(
    pending: PendingBet,
  ): { marketId: string; position: string }[] {
    return pending.portfolio.positions.map((p) => ({
      marketId: p.marketId,
      position: p.position,
    }))
  }

  /**
   * Build a JSON storage reference string from the bet's positions.
   * This is stored on-chain as the `jsonStorageRef` parameter.
   */
  function buildStorageRef(positions: PortfolioPosition[]): string {
    return JSON.stringify(
      positions.map((p) => ({
        marketId: p.marketId,
        position: p.position,
        confidence: p.confidence,
      })),
    )
  }

  /**
   * Execute a single approved pending bet, performing all safety checks
   * and chain interactions.
   */
  async function executeBet(pending: PendingBet): Promise<void> {
    const label = `[bet-executor] bet=${pending.id}`

    // --- Capital limiter ---
    const capitalCheck = capitalLimiter.check(pending.stakeWind)
    if (!capitalCheck.allowed) {
      console.log(`${label} Rejected by capital limiter: ${capitalCheck.reason}`)
      store.updatePendingBetStatus(pending.id, 'failed')
      return
    }

    // --- Circuit breaker ---
    const breakerCheck = circuitBreaker.check()
    if (!breakerCheck.allowed) {
      console.log(`${label} Rejected by circuit breaker: ${breakerCheck.reason}`)
      store.updatePendingBetStatus(pending.id, 'failed')
      return
    }

    const positions = extractPositions(pending)
    const amount = stakeToBigInt(pending.stakeWind)
    const now = Date.now()

    // --- Dry-run mode ---
    if (config.dryRun) {
      console.log(`${label} [DRY RUN] Would ${pending.action}:`, {
        stakeWind: pending.stakeWind,
        positions: positions.length,
        oddsBps: pending.oddsBps,
      })

      const record: BetRecord = {
        id: pending.id,
        betId: 'dry-run',
        action: pending.action,
        stakeWind: pending.stakeWind,
        oddsBps: pending.oddsBps,
        positions: pending.portfolio.positions,
        informedCount: pending.portfolio.informedCount,
        totalCount: pending.portfolio.totalCount,
        txHash: 'dry-run',
        status: 'active',
        pnl: null,
        createdAt: now,
        settledAt: null,
      }

      store.saveBet(record)
      store.updatePendingBetStatus(pending.id, 'executed')
      onExecuted?.(record)
      return
    }

    // --- Live execution ---
    const betHash = computeBetHash(positions)
    const storageRef = buildStorageRef(pending.portfolio.positions)

    let txHash: string
    let betId: string

    if (pending.action === 'place') {
      const result = await chain.placeBet(betHash, storageRef, amount)
      txHash = result.txHash
      betId = result.betId.toString()
    } else {
      // action === 'match'
      if (!pending.matchBetId) {
        throw new Error(`Match bet requires matchBetId, none provided`)
      }
      const result = await chain.matchBet(BigInt(pending.matchBetId), amount)
      txHash = result.txHash
      betId = pending.matchBetId
    }

    const record: BetRecord = {
      id: pending.id,
      betId,
      action: pending.action,
      stakeWind: pending.stakeWind,
      oddsBps: pending.oddsBps,
      positions: pending.portfolio.positions,
      informedCount: pending.portfolio.informedCount,
      totalCount: pending.portfolio.totalCount,
      txHash,
      status: 'active',
      pnl: null,
      createdAt: now,
      settledAt: null,
    }

    store.saveBet(record)
    store.updatePendingBetStatus(pending.id, 'executed')

    console.log(
      `${label} Executed ${pending.action}: txHash=${txHash}, betId=${betId}`,
    )

    onExecuted?.(record)
  }

  /**
   * Single polling tick: fetch approved bets and execute them sequentially.
   */
  async function tick(): Promise<void> {
    // Kill switch check
    const killSwitch = store.getKillSwitch()
    if (killSwitch.active) {
      console.log('[bet-executor] Kill switch active, skipping tick')
      return
    }

    const pendingBets = store.getPendingBets()
    const approved = pendingBets.filter((b) => b.status === 'approved')

    if (approved.length === 0) return

    console.log(`[bet-executor] Processing ${approved.length} approved bet(s)`)

    for (const pending of approved) {
      if (stopping) break

      try {
        await executeBet(pending)
      } catch (err) {
        console.error(
          `[bet-executor] Failed to execute bet=${pending.id}:`,
          err instanceof Error ? err.message : String(err),
        )
        store.updatePendingBetStatus(pending.id, 'failed')
      }
    }
  }

  // -------------------------------------------------------------------------
  // ServiceDefinition
  // -------------------------------------------------------------------------

  return {
    name: 'bet-executor',

    async start(): Promise<void> {
      stopping = false
      console.log(
        `[bet-executor] Starting (dryRun=${config.dryRun}, poll=${POLL_INTERVAL_MS}ms)`,
      )

      // Run an initial tick immediately
      await tick()

      intervalHandle = setInterval(() => {
        void tick()
      }, POLL_INTERVAL_MS)
    },

    async stop(): Promise<void> {
      console.log('[bet-executor] Stopping')
      stopping = true
      if (intervalHandle !== null) {
        clearInterval(intervalHandle)
        intervalHandle = null
      }
    },
  }
}
