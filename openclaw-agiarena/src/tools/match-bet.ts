/**
 * Match (fill) an existing open proposition from another bot.
 *
 * Fetches the target bet from the backend, validates it is still open,
 * builds a summary of the positions being matched, and queues the fill
 * through the approval gate for human confirmation.
 */

import type { ToolDefinition, Portfolio, PortfolioPosition } from '../types'
import type { ResearchStore } from '../research/store'
import type { BackendClient, BetPortfolioEntry } from '../adapters/backend-client'
import type { ApprovalGate } from '../safety/approval-gate'

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

export function createMatchBetTool(
  store: ResearchStore,
  backend: BackendClient,
  approvalGate: ApprovalGate,
): ToolDefinition {
  return {
    name: 'aa match-bet',
    description: 'Fill an existing open proposition',
    args: [
      { name: 'betId', description: 'Bet ID to match', required: true },
      { name: 'stake', description: 'Fill amount in WIND (optional, defaults to required match amount)' },
    ],
    handler: async (args, channel) => {
      const { betId } = args

      if (!betId) {
        return 'Usage: /aa match-bet <betId> [stake]'
      }

      // ---------------------------------------------------------------
      // 1. Fetch open bets and locate the target
      // ---------------------------------------------------------------

      const openBets = await backend.getBets({ status: 'open' })
      const targetBet = openBets.find((b) => b.betId === betId)

      if (!targetBet) {
        return `Bet ${betId} not found or not open.`
      }

      // ---------------------------------------------------------------
      // 2. Determine stake (default to requiredMatch amount)
      // ---------------------------------------------------------------

      const requiredMatch = parseFloat(targetBet.requiredMatch) || 0
      const stakeWind = args.stake ? parseFloat(args.stake) : requiredMatch

      if (Number.isNaN(stakeWind) || stakeWind <= 0) {
        return `Invalid stake amount. Required match: ${requiredMatch.toFixed(2)} WIND`
      }

      if (stakeWind > requiredMatch) {
        return `Stake ${stakeWind} WIND exceeds required match amount (${requiredMatch.toFixed(2)} WIND).`
      }

      // ---------------------------------------------------------------
      // 3. Fetch portfolio positions for the target bet
      // ---------------------------------------------------------------

      let betPortfolio: BetPortfolioEntry[]
      try {
        betPortfolio = await backend.getBetPortfolio(targetBet.betId)
      } catch (err) {
        return `Failed to fetch portfolio for bet ${targetBet.betId}: ${err instanceof Error ? err.message : String(err)}`
      }

      if (betPortfolio.length === 0) {
        return `Bet ${targetBet.betId} has no portfolio positions.`
      }

      // ---------------------------------------------------------------
      // 4. Build portfolio representation for the pending bet
      // ---------------------------------------------------------------

      const positions: PortfolioPosition[] = betPortfolio.map((entry) => ({
        marketId: entry.marketId,
        position: normalizePosition(entry.position),
        confidence: entry.confidence,
      }))

      // Count how many positions we have research for (informed)
      const informedCount = positions.filter((p) => {
        const research = store.getResearch(p.marketId)
        return research !== null
      }).length

      const portfolio: Portfolio = {
        positions,
        createdAt: new Date().toISOString(),
        informedCount,
        totalCount: positions.length,
      }

      // ---------------------------------------------------------------
      // 5. Build human-readable summary
      // ---------------------------------------------------------------

      const creatorStakeNum = parseFloat(targetBet.creatorStake) || 0
      const summaryLines = [
        `Matching bet ${targetBet.betId} by ${targetBet.creatorAddress}`,
        `Creator stake: ${creatorStakeNum.toFixed(2)} WIND at ${targetBet.oddsBps} bps`,
        `Fill amount: ${stakeWind.toFixed(2)} WIND`,
        `Positions: ${positions.length} market(s)`,
      ]

      if (informedCount > 0) {
        summaryLines.push(`Research coverage: ${informedCount}/${positions.length} positions`)
      }

      const summary = summaryLines.join(' | ')

      // ---------------------------------------------------------------
      // 6. Queue for approval
      // ---------------------------------------------------------------

      const id = await approvalGate.queue(
        {
          action: 'match',
          portfolio,
          stakeWind,
          oddsBps: targetBet.oddsBps,
          summary,
          matchBetId: targetBet.betId,
        },
        channel,
      )

      return [
        `Match queued for approval. ID: ${id}`,
        `Target: ${targetBet.betId} (${stakeWind.toFixed(2)} WIND of ${requiredMatch.toFixed(2)} required)`,
        `Check your channel for approval details.`,
      ].join('\n')
    },
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a position string from the backend into the canonical union type.
 *
 * The backend may return positions in varying cases; we normalise to
 * the uppercase literals used throughout the plugin.
 */
function normalizePosition(raw: string): PortfolioPosition['position'] {
  const upper = raw.toUpperCase()
  if (upper === 'YES' || upper === 'NO' || upper === 'LONG' || upper === 'SHORT') {
    return upper
  }
  // Default to YES for unrecognised values -- conservative fallback
  return 'YES'
}
