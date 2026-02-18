import type { ToolDefinition } from '../types'
import type { ResearchStore } from '../research/store'

/**
 * Shows the top scored positions by expected value.
 *
 * Pulls the 20 highest-confidence, non-expired research results from the
 * store and formats them as a ranked list with probability, confidence,
 * and estimated edge for quick operator review.
 */
export function createGetScoresTool(store: ResearchStore): ToolDefinition {
  return {
    name: 'aa scores',
    description: 'Top 20 highest-EV positions',
    handler: async (_args, _channel) => {
      const results = store.getTopResearch(20)

      if (results.length === 0) {
        return 'No scored markets yet. Run /aa discover to find markets.'
      }

      const lines = results.map((r) => {
        const probStr = r.probYes.toFixed(2)
        const confStr = r.confidence.toFixed(2)

        // Try to retrieve market odds from the config store for edge calculation.
        // Market odds are persisted as "odds:<marketId>" during discovery.
        const oddsRaw = store.getConfig(`odds:${r.marketId}`)
        let edgeStr: string

        if (oddsRaw !== null) {
          const marketOdds = parseFloat(oddsRaw)
          if (!Number.isNaN(marketOdds)) {
            const edge = r.probYes - marketOdds
            const sign = edge >= 0 ? '+' : ''
            edgeStr = `edge: ${sign}${(edge * 100).toFixed(0)}%`
          } else {
            edgeStr = 'edge: n/a'
          }
        } else {
          edgeStr = 'edge: n/a'
        }

        return `  \u2022 "${r.question}" (${r.source}) \u2014 P(YES)=${probStr}, conf=${confStr}, ${edgeStr}`
      })

      return `[TOP SCORES]\n${lines.join('\n')}`
    },
  }
}
