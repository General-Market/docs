/**
 * Discovery source adapters and coordinator.
 *
 * Each source implements SourceAdapter to produce DiscoveredMarket[]
 * from a specific data feed. The DiscoveryCoordinator runs all sources
 * in parallel, deduplicates results, and returns the top-N by urgency.
 */

import type { BackendClient, Proposition } from '../adapters/backend-client'
import type { DiscoveredMarket, DiscoverySource } from '../types'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

// ---------------------------------------------------------------------------
// Adapter interface
// ---------------------------------------------------------------------------

export interface SourceAdapter {
  name: DiscoverySource
  fetch(): Promise<DiscoveredMarket[]>
}

// ---------------------------------------------------------------------------
// Urgency scoring
// ---------------------------------------------------------------------------

export function calculateUrgency(market: Partial<DiscoveredMarket>): number {
  let score = 0
  const hoursOld = (Date.now() - (market.discoveredAt ?? Date.now())) / 3_600_000

  if (hoursOld < 2) score += 20
  else if (hoursOld < 12) score += 10

  score += Math.min((market.volume24h ?? 0) / 10_000, 20)

  if (market.source === 'aa_propositions') score += 15

  return Math.min(score, 100)
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 10_000

/** Deterministic ID from source + key. */
function makeId(source: DiscoverySource, key: string): string {
  return createHash('sha256').update(`${source}:${key}`).digest('hex').slice(0, 16)
}

/** fetch wrapper with abort-based timeout. */
async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
  try {
    return await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Source 1: Polymarket
// ---------------------------------------------------------------------------

interface PolymarketEntry {
  question: string
  slug: string
  outcomes: string
  outcomePrices: string
  volume24hr: number
  endDate: string
}

export class PolymarketSource implements SourceAdapter {
  readonly name: DiscoverySource = 'polymarket'

  async fetch(): Promise<DiscoveredMarket[]> {
    const url =
      'https://gamma-api.polymarket.com/markets?closed=false&limit=100&order=volume24hr&ascending=false'
    const res = await fetchWithTimeout(url)

    if (!res.ok) {
      throw new Error(`Polymarket API ${res.status}: ${res.statusText}`)
    }

    const data = (await res.json()) as PolymarketEntry[]
    const now = Date.now()

    return data.map((m) => {
      const prices = parsePrices(m.outcomePrices)
      const market: DiscoveredMarket = {
        id: makeId('polymarket', m.slug),
        source: 'polymarket',
        question: m.question,
        currentOddsYes: prices[0] ?? null,
        resolutionDate: m.endDate || null,
        volume24h: m.volume24hr ?? 0,
        urgencyScore: 0,
        metadata: {
          slug: m.slug,
          outcomes: m.outcomes,
        },
        discoveredAt: now,
      }
      market.urgencyScore = calculateUrgency(market)
      return market
    })
  }
}

function parsePrices(raw: string | undefined): number[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw) as (string | number)[]
    return parsed.map(Number)
  } catch {
    return []
  }
}

// ---------------------------------------------------------------------------
// Source 2: AA Backend (snapshot diff)
// ---------------------------------------------------------------------------

export class AABackendSource implements SourceAdapter {
  readonly name: DiscoverySource = 'aa_backend'
  private previousSnapshotIds = new Set<string>()

  constructor(private readonly backend: BackendClient) {}

  async fetch(): Promise<DiscoveredMarket[]> {
    const response = await this.backend.getCurrentSnapshots()
    const now = Date.now()

    // response.snapshots is Record<categoryId, SnapshotInfo>
    const entries = Object.entries(response.snapshots)
    const currentIds = new Set<string>(entries.map(([, snap]) => snap.snapshotId))

    // On first call, seed the set and return nothing (no baseline to diff against)
    if (this.previousSnapshotIds.size === 0) {
      this.previousSnapshotIds = currentIds
      return []
    }

    const newEntries = entries.filter(([, snap]) => !this.previousSnapshotIds.has(snap.snapshotId))
    this.previousSnapshotIds = currentIds

    return newEntries.map(([categoryId, snap]) => {
      const market: DiscoveredMarket = {
        id: makeId('aa_backend', snap.snapshotId),
        source: 'aa_backend',
        question: `New snapshot for category "${categoryId}"`,
        currentOddsYes: null,
        resolutionDate: snap.expiresAt || null,
        volume24h: 0,
        urgencyScore: 0,
        metadata: {
          snapshotId: snap.snapshotId,
          categoryId,
          hashes: snap.hashes,
          createdAt: snap.createdAt,
          expiresAt: snap.expiresAt,
        },
        discoveredAt: now,
      }
      market.urgencyScore = calculateUrgency(market)
      return market
    })
  }
}

// ---------------------------------------------------------------------------
// Source 3: Web Search (placeholder)
// ---------------------------------------------------------------------------

export class WebSearchSource implements SourceAdapter {
  readonly name: DiscoverySource = 'web_search'

  async fetch(): Promise<DiscoveredMarket[]> {
    // Web search happens inside research workers (ClaudeController), not discovery.
    // This adapter exists as a placeholder so the source enum is represented.
    return []
  }
}

// ---------------------------------------------------------------------------
// Source 4: CoinGecko
// ---------------------------------------------------------------------------

interface CoinGeckoEntry {
  id: string
  symbol: string
  name: string
  current_price: number
  market_cap: number
  total_volume: number
  price_change_percentage_24h: number | null
}

export class CoinGeckoSource implements SourceAdapter {
  readonly name: DiscoverySource = 'coingecko'
  private knownCoinIds = new Set<string>()

  async fetch(): Promise<DiscoveredMarket[]> {
    const url =
      'https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=100&page=1'
    const res = await fetchWithTimeout(url)

    if (!res.ok) {
      throw new Error(`CoinGecko API ${res.status}: ${res.statusText}`)
    }

    const data = (await res.json()) as CoinGeckoEntry[]
    const now = Date.now()

    // On first call, seed the known set and return nothing
    if (this.knownCoinIds.size === 0) {
      for (const coin of data) {
        this.knownCoinIds.add(coin.id)
      }
      return []
    }

    const newCoins = data.filter((c) => !this.knownCoinIds.has(c.id))
    for (const coin of data) {
      this.knownCoinIds.add(coin.id)
    }

    return newCoins.map((c) => {
      const market: DiscoveredMarket = {
        id: makeId('coingecko', c.id),
        source: 'coingecko',
        question: `Will ${c.name} price increase in next 24h?`,
        currentOddsYes: null,
        resolutionDate: null,
        volume24h: c.total_volume ?? 0,
        urgencyScore: 0,
        metadata: {
          coinId: c.id,
          symbol: c.symbol,
          name: c.name,
          price: c.current_price,
          marketCap: c.market_cap,
          change24hPct: c.price_change_percentage_24h,
        },
        discoveredAt: now,
      }
      market.urgencyScore = calculateUrgency(market)
      return market
    })
  }
}

// ---------------------------------------------------------------------------
// Source 5: AA Propositions
// ---------------------------------------------------------------------------

export class AAPropositionsSource implements SourceAdapter {
  readonly name: DiscoverySource = 'aa_propositions'

  constructor(private readonly backend: BackendClient) {}

  async fetch(): Promise<DiscoveredMarket[]> {
    const response = await this.backend.getPropositions({ status: 'open' })
    const now = Date.now()

    return response.propositions.map((p: Proposition) => {
      const stakeNum = parseFloat(p.creatorStake) || 0
      const market: DiscoveredMarket = {
        id: makeId('aa_propositions', p.propositionHash),
        source: 'aa_propositions',
        question: `Proposition by ${p.creator} (${p.categoryId ?? 'uncategorized'})`,
        currentOddsYes: p.oddsBps / 10_000,
        resolutionDate: p.expiry || null,
        volume24h: stakeNum,
        urgencyScore: 0,
        metadata: {
          propositionHash: p.propositionHash,
          categoryId: p.categoryId,
          creator: p.creator,
          oddsBps: p.oddsBps,
          creatorStake: p.creatorStake,
          requiredMatch: p.requiredMatch,
          status: p.status,
          createdAt: p.createdAt,
        },
        discoveredAt: now,
      }
      market.urgencyScore = calculateUrgency(market)
      return market
    })
  }
}

// ---------------------------------------------------------------------------
// Source 6: DEX Tracker (CSV file)
// ---------------------------------------------------------------------------

export class DexTrackerSource implements SourceAdapter {
  readonly name: DiscoverySource = 'dex_tracker'
  private knownPairs = new Set<string>()

  constructor(private readonly csvPath?: string) {}

  async fetch(): Promise<DiscoveredMarket[]> {
    if (!this.csvPath) return []

    let content: string
    try {
      content = await readFile(this.csvPath, 'utf-8')
    } catch {
      // File doesn't exist or is unreadable -- no-op
      return []
    }

    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && !l.startsWith('#'))

    // Skip header if present
    const header = lines[0]
    const dataLines = header?.toLowerCase().includes('pair') ? lines.slice(1) : lines

    const now = Date.now()
    const markets: DiscoveredMarket[] = []

    for (const line of dataLines) {
      // Expected CSV: pair,token0,token1,dex,chain,volume24h
      const cols = line.split(',').map((c) => c.trim())
      const pair = cols[0]
      if (!pair) continue

      if (this.knownPairs.has(pair)) continue
      this.knownPairs.add(pair)

      const volume = parseFloat(cols[5] ?? '0') || 0
      const market: DiscoveredMarket = {
        id: makeId('dex_tracker', pair),
        source: 'dex_tracker',
        question: `Will ${pair} trading pair increase in next 24h?`,
        currentOddsYes: null,
        resolutionDate: null,
        volume24h: volume,
        urgencyScore: 0,
        metadata: {
          pair,
          token0: cols[1] ?? null,
          token1: cols[2] ?? null,
          dex: cols[3] ?? null,
          chain: cols[4] ?? null,
        },
        discoveredAt: now,
      }
      market.urgencyScore = calculateUrgency(market)
      markets.push(market)
    }

    return markets
  }
}

// ---------------------------------------------------------------------------
// Discovery coordinator
// ---------------------------------------------------------------------------

export class DiscoveryCoordinator {
  private sources: SourceAdapter[]

  constructor(backend: BackendClient, config?: { dexTrackerPath?: string }) {
    this.sources = [
      new PolymarketSource(),
      new AABackendSource(backend),
      new WebSearchSource(),
      new CoinGeckoSource(),
      new AAPropositionsSource(backend),
      new DexTrackerSource(config?.dexTrackerPath),
    ]
  }

  /** Run all sources, deduplicate, sort by urgency, return top N. */
  async discover(topN: number = 50): Promise<DiscoveredMarket[]> {
    const results = await Promise.allSettled(
      this.sources.map(async (source) => {
        try {
          return await source.fetch()
        } catch (err) {
          console.error(
            `[discovery] Source "${source.name}" failed:`,
            err instanceof Error ? err.message : String(err)
          )
          return []
        }
      })
    )

    const allMarkets: DiscoveredMarket[] = []
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allMarkets.push(...result.value)
      }
      // Rejected promises are already logged above; the Promise.allSettled
      // catch + inner try/catch means rejections here should not happen,
      // but we guard defensively.
    }

    // Deduplicate by market ID, keeping the first occurrence
    const seen = new Map<string, DiscoveredMarket>()
    for (const market of allMarkets) {
      if (!seen.has(market.id)) {
        seen.set(market.id, market)
      }
    }

    const unique = Array.from(seen.values())
    unique.sort((a, b) => b.urgencyScore - a.urgencyScore)
    return unique.slice(0, topN)
  }
}
