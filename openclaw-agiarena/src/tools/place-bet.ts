/**
 * Place a researched bet, gated by human approval.
 *
 * Pulls active research from the store, constructs a portfolio via the
 * portfolio builder, and queues the bet through the approval gate. No
 * on-chain action happens until the operator explicitly approves.
 */

import type { ToolDefinition, Portfolio, ResearchResult } from '../types'
import type { ResearchStore } from '../research/store'
import type { ApprovalGate } from '../safety/approval-gate'
import { buildInformedPortfolio } from '../strategy/portfolio-builder'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Shape expected by buildInformedPortfolio. */
interface TradeEntry {
  id: string
  marketPrice: number
  source: string
}

// ---------------------------------------------------------------------------
// Tool factory
// ---------------------------------------------------------------------------

export function createPlaceBetTool(
  store: ResearchStore,
  approvalGate: ApprovalGate,
): ToolDefinition {
  return {
    name: 'aa place-bet',
    description: 'Place a researched bet (gated by approval)',
    args: [
      { name: 'category', description: 'Category ID (e.g., crypto, predictions)' },
      { name: 'stake', description: 'Stake amount in WIND (default: 0.5)' },
      { name: 'odds', description: 'Odds in basis points (default: 10000)' },
    ],
    handler: async (args, channel) => {
      const stakeWind = parseFloat(args.stake) || 0.5
      const oddsBps = parseInt(args.odds, 10) || 10_000
      const categoryId = args.category || undefined

      // ---------------------------------------------------------------
      // 1. Gather active research
      // ---------------------------------------------------------------

      const research = store.getActiveResearch()

      if (research.length === 0) {
        return 'No research data. Run /aa discover first.'
      }

      // ---------------------------------------------------------------
      // 2. Build trade list from research results
      // ---------------------------------------------------------------

      const tradeList: TradeEntry[] = research.map((r) => researchToTrade(r, store))

      // ---------------------------------------------------------------
      // 3. Build portfolio via strategy module
      // ---------------------------------------------------------------

      const portfolio: Portfolio = buildInformedPortfolio(
        tradeList,
        store,
        oddsBps,
      )

      // ---------------------------------------------------------------
      // 4. Identify top conviction for summary
      // ---------------------------------------------------------------

      const topConviction = portfolio.positions.length > 0
        ? portfolio.positions.reduce(
            (best, pos) => (pos.confidence > best.confidence ? pos : best),
            portfolio.positions[0],
          )
        : null

      const informedPct =
        portfolio.totalCount > 0
          ? ((portfolio.informedCount / portfolio.totalCount) * 100).toFixed(0)
          : '0'

      // ---------------------------------------------------------------
      // 5. Build human-readable summary
      // ---------------------------------------------------------------

      const summaryLines = [
        `AI positions: ${portfolio.informedCount}/${portfolio.totalCount} (${informedPct}%)`,
      ]

      if (topConviction) {
        summaryLines.push(
          `Top conviction: ${topConviction.position} on ${topConviction.marketId} (${(topConviction.confidence * 100).toFixed(1)}%)`,
        )
      }

      // Compute average edge from the underlying research
      const avgEdge = computeAverageEdge(research, store)
      summaryLines.push(`Expected edge: ${avgEdge >= 0 ? '+' : ''}${(avgEdge * 100).toFixed(1)}%`)

      const summary = summaryLines.join(' | ')

      // ---------------------------------------------------------------
      // 6. Queue for approval
      // ---------------------------------------------------------------

      const id = await approvalGate.queue(
        {
          action: 'place',
          portfolio,
          stakeWind,
          oddsBps,
          categoryId,
          summary,
        },
        channel,
      )

      return `Bet queued for approval. Check your channel for details. ID: ${id}`
    },
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert a ResearchResult into a TradeEntry for the portfolio builder.
 *
 * The portfolio builder uses the market's stored odds as the market price.
 * Falls back to 0.5 (no edge) when odds are unknown.
 */
function researchToTrade(result: ResearchResult, store: ResearchStore): TradeEntry {
  const oddsRaw = store.getConfig(`odds:${result.marketId}`)
  const marketPrice = oddsRaw !== null ? parseFloat(oddsRaw) : 0.5

  return {
    id: result.marketId,
    marketPrice: Number.isNaN(marketPrice) ? 0.5 : marketPrice,
    source: result.source,
  }
}

/**
 * Compute the mean edge across all active research results.
 *
 * Edge is defined as `probYes - marketOdds`. When market odds are not
 * available for a given market, that result is excluded from the average.
 */
function computeAverageEdge(
  research: ResearchResult[],
  store: ResearchStore,
): number {
  let totalEdge = 0
  let count = 0

  for (const r of research) {
    const oddsRaw = store.getConfig(`odds:${r.marketId}`)
    if (oddsRaw === null) continue

    const marketOdds = parseFloat(oddsRaw)
    if (Number.isNaN(marketOdds)) continue

    totalEdge += r.probYes - marketOdds
    count++
  }

  return count > 0 ? totalEdge / count : 0
}
