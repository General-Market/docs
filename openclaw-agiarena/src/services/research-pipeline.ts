/**
 * Research pipeline — worker pool that processes discovered markets.
 *
 * Maintains an internal queue of markets to research, spawns up to
 * `maxWorkers` parallel Claude research calls per batch, aggregates
 * incoming results with prior research, and persists everything to
 * the SQLite store.
 *
 * Respects the kill switch and skips markets that already have recent,
 * high-confidence research.
 */

import type { ResearchStore } from '../research/store'
import type {
  ServiceDefinition,
  DiscoveredMarket,
  ResearchResult,
} from '../types'
import { ResearchWorker } from '../research/worker'
import { aggregateResearch } from '../research/aggregator'

const BATCH_DELAY_MS = 2_000
const BATCH_TIMEOUT_MS = 120_000
const RECENT_THRESHOLD_MS = 12 * 60 * 60 * 1000 // 12 hours
const MIN_CONFIDENCE_FOR_SKIP = 0.5

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms,
    )
    promise.then(
      (val) => { clearTimeout(timer); resolve(val) },
      (err) => { clearTimeout(timer); reject(err) },
    )
  })
}

export function createResearchPipeline(
  store: ResearchStore,
  config: { maxWorkers: number; maxMarkets: number },
  onResearched?: (results: ResearchResult[]) => void,
): ServiceDefinition & {
  /** Enqueue markets for research */
  enqueue(markets: DiscoveredMarket[]): void
  /** Research a single market immediately (for /aa research command) */
  researchOne(market: DiscoveredMarket): Promise<ResearchResult>
  /** Get queue length */
  getQueueLength(): number
} {
  const queue: DiscoveredMarket[] = []
  let running = false
  let loopHandle: ReturnType<typeof setTimeout> | null = null

  // -------------------------------------------------------------------------
  // Queue management
  // -------------------------------------------------------------------------

  function enqueue(markets: DiscoveredMarket[]): void {
    for (const market of markets) {
      // Enforce max queue size
      if (queue.length >= config.maxMarkets) break

      // Skip duplicates already in queue
      if (queue.some((m) => m.id === market.id)) continue

      // Skip if recently researched with sufficient confidence
      if (shouldSkip(market.id)) continue

      queue.push(market)
    }
  }

  function shouldSkip(marketId: string): boolean {
    const existing = store.getResearch(marketId)
    if (!existing) return false

    const age = Date.now() - existing.researchedAt
    return age < RECENT_THRESHOLD_MS && existing.confidence >= MIN_CONFIDENCE_FOR_SKIP
  }

  function getQueueLength(): number {
    return queue.length
  }

  // -------------------------------------------------------------------------
  // Processing loop
  // -------------------------------------------------------------------------

  async function processBatch(): Promise<void> {
    // Check kill switch before each batch
    const killSwitch = store.getKillSwitch()
    if (killSwitch.active) return

    if (queue.length === 0) return

    // Take up to maxWorkers items from front of queue
    const batch = queue.splice(0, config.maxWorkers)

    // Research all items in the batch in parallel
    const worker = new ResearchWorker()
    const results = await Promise.all(
      batch.map((market) => worker.research(market)),
    )

    // Aggregate with existing research and persist
    const aggregated: ResearchResult[] = []
    for (const result of results) {
      const existing = store.getResearch(result.marketId)
      const merged = aggregateResearch(existing, result)
      store.upsertResearch(merged)
      aggregated.push(merged)
    }

    // Notify consumer
    if (onResearched && aggregated.length > 0) {
      onResearched(aggregated)
    }
  }

  async function loop(): Promise<void> {
    while (running) {
      try {
        await withTimeout(processBatch(), BATCH_TIMEOUT_MS, 'processBatch')
      } catch (error) {
        console.error(
          '[agiarena] Research pipeline batch error:',
          error instanceof Error ? error.message : error,
        )
      }

      // Wait between batches to avoid rate limits
      if (running) {
        await delay(BATCH_DELAY_MS)
      }
    }
  }

  // -------------------------------------------------------------------------
  // Immediate single-market research (for /aa research command)
  // -------------------------------------------------------------------------

  async function researchOne(
    market: DiscoveredMarket,
  ): Promise<ResearchResult> {
    const worker = new ResearchWorker()
    const result = await worker.research(market)

    // Aggregate and persist
    const existing = store.getResearch(result.marketId)
    const merged = aggregateResearch(existing, result)
    store.upsertResearch(merged)

    return merged
  }

  // -------------------------------------------------------------------------
  // Service lifecycle
  // -------------------------------------------------------------------------

  async function start(): Promise<void> {
    if (running) return
    running = true
    console.log('[agiarena] Research pipeline started')

    // Fire-and-forget the loop — it runs until stop() is called
    loop().catch((error) => {
      console.error(
        '[agiarena] Research pipeline loop crashed:',
        error instanceof Error ? error.message : error,
      )
      running = false
    })
  }

  async function stop(): Promise<void> {
    running = false
    queue.length = 0

    if (loopHandle !== null) {
      clearTimeout(loopHandle)
      loopHandle = null
    }

    console.log('[agiarena] Research pipeline stopped')
  }

  return {
    name: 'research-pipeline',
    start,
    stop,
    enqueue,
    researchOne,
    getQueueLength,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
