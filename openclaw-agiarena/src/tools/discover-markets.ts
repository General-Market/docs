/**
 * Tools for manual market discovery and ad-hoc research.
 *
 * - `aa discover` — triggers the discovery coordinator and enqueues
 *   the results into the research pipeline.
 * - `aa research` — creates a synthetic market from a topic string
 *   and runs a single immediate research pass.
 */

import type { ToolDefinition, DiscoveredMarket, ResearchResult } from '../types'
import type { DiscoveryCoordinator } from '../research/sources'

// ---------------------------------------------------------------------------
// aa discover
// ---------------------------------------------------------------------------

/**
 * Creates the `/aa discover` tool which triggers market discovery,
 * enqueues results for background research, and returns a summary
 * of the top newly-found markets.
 */
export function createDiscoverMarketsTool(
  coordinator: DiscoveryCoordinator,
  enqueueForResearch: (markets: DiscoveredMarket[]) => void,
): ToolDefinition {
  return {
    name: 'aa discover',
    description: 'Trigger immediate market discovery',
    handler: async (_args, _channel) => {
      const markets = await coordinator.discover(50)

      if (markets.length === 0) {
        return '[NEW MARKETS] No new markets discovered.'
      }

      // Enqueue all discovered markets into the research pipeline
      enqueueForResearch(markets)

      // Format the top 10 by urgency for the operator
      const sorted = [...markets].sort(
        (a, b) => b.urgencyScore - a.urgencyScore,
      )
      const top = sorted.slice(0, 10)

      const lines = top.map((m) => {
        const vol = formatVolume(m.volume24h)
        return `  \u2022 "${m.question}" (${m.source}, vol $${vol}) \u2014 urgency: ${m.urgencyScore}`
      })

      return [
        `[NEW MARKETS] Discovered ${markets.length} new markets:`,
        ...lines,
        '',
        `Researching top ${Math.min(markets.length, 50)}. ETA ~15 min.`,
      ].join('\n')
    },
  }
}

// ---------------------------------------------------------------------------
// aa research
// ---------------------------------------------------------------------------

/**
 * Creates the `/aa research "<topic>"` tool which constructs a
 * synthetic DiscoveredMarket from the supplied topic string and
 * runs a single immediate Claude research pass.
 */
export function createResearchMarketTool(
  researchOne: (market: DiscoveredMarket) => Promise<ResearchResult>,
): ToolDefinition {
  return {
    name: 'aa research',
    description: 'Deep-research a specific market or question',
    args: [
      { name: 'topic', description: 'Market or topic to research', required: true },
    ],
    handler: async (args, _channel) => {
      const { topic } = args

      if (!topic) {
        return 'Usage: /aa research "Will Bitcoin reach $100k by end of 2026?"'
      }

      // Build a synthetic DiscoveredMarket from the free-text topic
      const market: DiscoveredMarket = {
        id: `manual-${slugify(topic)}-${Date.now()}`,
        source: 'web_search',
        question: topic,
        currentOddsYes: null,
        resolutionDate: null,
        volume24h: 0,
        urgencyScore: 50,
        metadata: { manual: true },
        discoveredAt: Date.now(),
      }

      const result = await researchOne(market)

      const probStr = (result.probYes * 100).toFixed(0)
      const confStr = (result.confidence * 100).toFixed(0)
      const sourcesStr =
        result.sources.length > 0
          ? result.sources.map((s) => `  - ${s}`).join('\n')
          : '  (none)'

      return [
        `[RESEARCH] "${topic}"`,
        `P(YES): ${probStr}%`,
        `Confidence: ${confStr}%`,
        `Reasoning: ${result.reasoning}`,
        `Sources:`,
        sourcesStr,
      ].join('\n')
    },
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Format a USD volume number into a human-readable string.
 * e.g. 1_234_567 -> "1.2M", 45_000 -> "45.0K"
 */
function formatVolume(volume: number): string {
  if (volume >= 1_000_000) return `${(volume / 1_000_000).toFixed(1)}M`
  if (volume >= 1_000) return `${(volume / 1_000).toFixed(1)}K`
  return volume.toFixed(0)
}

/**
 * Turn a free-text string into a URL-safe slug for use as a market ID.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
}
