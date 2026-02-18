/**
 * Scheduled discovery service.
 *
 * Polls all discovery sources on a configurable interval, deduplicates
 * against previously-seen markets, and forwards new discoveries to a
 * callback (typically the research pipeline).
 */

import type { DiscoveryCoordinator } from '../research/sources'
import type { ResearchStore } from '../research/store'
import type { ServiceDefinition, DiscoveredMarket } from '../types'

export function createDiscoveryService(
  coordinator: DiscoveryCoordinator,
  store: ResearchStore,
  config: { intervalMin: number },
  onDiscovered?: (markets: DiscoveredMarket[]) => void
): ServiceDefinition {
  let intervalHandle: ReturnType<typeof setInterval> | null = null
  const seenIds = new Set<string>()

  async function runDiscovery(): Promise<void> {
    // Respect the kill switch before doing any work
    const killSwitch = store.getKillSwitch()
    if (killSwitch.active) {
      console.log('[discovery] Kill switch active, skipping run')
      return
    }

    try {
      const markets = await coordinator.discover(50)

      // Filter to only truly new markets we haven't emitted before
      const newMarkets: DiscoveredMarket[] = []
      for (const market of markets) {
        if (!seenIds.has(market.id)) {
          seenIds.add(market.id)
          newMarkets.push(market)
        }
      }

      console.log(
        `[discovery] Found ${markets.length} markets, ${newMarkets.length} new`
      )

      if (newMarkets.length > 0 && onDiscovered) {
        onDiscovered(newMarkets)
      }
    } catch (err) {
      console.error(
        '[discovery] Run failed:',
        err instanceof Error ? err.message : String(err)
      )
    }
  }

  return {
    name: 'discovery',

    async start(): Promise<void> {
      console.log(
        `[discovery] Starting with ${config.intervalMin}min interval`
      )

      // Run immediately on start
      await runDiscovery()

      // Then schedule recurring runs
      const intervalMs = config.intervalMin * 60_000
      intervalHandle = setInterval(() => {
        void runDiscovery()
      }, intervalMs)
    },

    async stop(): Promise<void> {
      console.log('[discovery] Stopping')
      if (intervalHandle !== null) {
        clearInterval(intervalHandle)
        intervalHandle = null
      }
    },
  }
}
