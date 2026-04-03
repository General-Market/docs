/**
 * Server-side data prefetching for the homepage.
 * Calls upstream services directly (no HTTP round-trip through API routes).
 * Results are hydrated into React Query cache via HydrationBoundary.
 */
import { getAaDataNodeUrl, getDataNodeServer, getIssuerVisionUrl } from '@/lib/config'

// ── Snapshot Meta ───────────────────────────────────────
interface BulkSourceEntry {
  totalAssets: number
  activeAssets: number
  newestRecord: string | null
}

interface BulkStatsResponse {
  totalAssets: number
  totalActiveAssets: number
  sourceCount: number
  sources: Record<string, BulkSourceEntry>
}

function deriveStatus(entry: BulkSourceEntry): string {
  if (entry.activeAssets === 0) return 'not_started'
  if (!entry.newestRecord) return 'stale'
  const age = Date.now() - new Date(entry.newestRecord).getTime()
  if (age > 7 * 24 * 3600 * 1000) return 'stale'
  return 'healthy'
}

export async function prefetchSnapshotMeta() {
  const res = await fetch(`${getAaDataNodeUrl()}/market/stats`, {
    next: { revalidate: 30 },
    signal: AbortSignal.timeout(5_000),
  })
  if (!res.ok) throw new Error(`Bulk stats HTTP ${res.status}`)
  const bulk: BulkStatsResponse = await res.json()

  const assetCounts: Record<string, number> = {}
  const sources = Object.entries(bulk.sources).map(([id, entry]) => {
    assetCounts[id] = entry.totalAssets
    return {
      sourceId: id,
      displayName: id,
      enabled: true,
      syncIntervalSecs: 300,
      lastSync: entry.newestRecord,
      nextSync: null,
      estimatedNextUpdate: null,
      status: deriveStatus(entry),
    }
  })

  return {
    generatedAt: new Date().toISOString(),
    totalAssets: bulk.totalAssets,
    totalSources: sources.filter(s => s.status === 'healthy' || s.status === 'stale').length,
    totalCategories: 10,
    sources,
    assetCounts,
  }
}

// ── Leaderboard ─────────────────────────────────────────
function parseNum(v: unknown): number {
  if (typeof v === 'number') return isNaN(v) ? 0 : v
  if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? 0 : n }
  return 0
}

export async function prefetchLeaderboard() {
  const res = await fetch(`${getIssuerVisionUrl()}/vision/leaderboard`, {
    next: { revalidate: 15 },
    signal: AbortSignal.timeout(5_000),
  })
  if (!res.ok) throw new Error(`Leaderboard HTTP ${res.status}`)
  const data = await res.json()
  const entries = data.leaderboard ?? []

  const leaderboard = entries.map((e: Record<string, unknown>) => ({
    rank: (e.rank as number) ?? 0,
    walletAddress: (e.walletAddress as string) ?? '',
    pnl: parseNum(e.pnl),
    winRate: parseNum(e.winRate),
    roi: parseNum(e.roi),
    totalVolume: parseNum(e.totalVolume),
    portfolioBets: (e.portfolioBets as number) ?? 0,
    avgPortfolioSize: parseNum(e.avgPortfolioSize),
    largestPortfolio: (e.largestPortfolio as number) ?? 0,
    roundsPlayed: parseNum(e.roundsPlayed),
    roundsWon: parseNum(e.roundsWon),
    avgCorrectPct: parseNum(e.avgCorrectPct),
    volume: parseNum(e.totalVolume),
    totalBets: (e.portfolioBets as number) ?? 0,
    maxPortfolioSize: (e.largestPortfolio as number) ?? 0,
  }))

  return {
    leaderboard,
    updatedAt: data.updatedAt ?? new Date().toISOString(),
  }
}

// ── Per-Source Detail Prefetch ───────────────────────────
/** Prefetch source snapshot server-side (same data useSourceSnapshot fetches client-side).
 *  Must return the same shape as /api/vision/snapshot — client reads `prices`, not `snapshots`. */
export async function prefetchSourceSnapshot(sourceId: string) {
  const res = await fetch(
    `${getAaDataNodeUrl()}/vision/snapshot?source=${encodeURIComponent(sourceId)}&limit=10000`,
    { next: { revalidate: 30 }, signal: AbortSignal.timeout(8_000) }
  )
  if (!res.ok) throw new Error(`Snapshot HTTP ${res.status}`)
  const raw = await res.json()
  const snapshots: Array<Record<string, unknown>> = raw.snapshots ?? []
  return {
    generatedAt: new Date().toISOString(),
    maxAgeSecs: null,
    totalAssets: snapshots.length,
    sources: [],
    prices: snapshots.map((s) => ({
      source: s.source,
      assetId: s.assetId,
      symbol: s.symbol,
      name: s.name,
      category: s.category ?? null,
      value: s.value,
      prevClose: null,
      changePct: s.changePct ?? null,
      volume24h: s.volume24h ?? null,
      marketCap: s.marketCap ?? null,
      fetchedAt: s.fetchedAt,
      imageUrl: (s.imageUrl as string) ?? null,
    })),
  }
}

/** Prefetch batch config for a source server-side */
export async function prefetchBatchConfigBySource(sourceId: string) {
  const { toInternalId } = await import('@/lib/vision/source-ids')
  const internalId = toInternalId(sourceId)
  const candidates = internalId !== sourceId ? [internalId, sourceId] : [sourceId]
  const results = await Promise.all(
    candidates.map(async (name) => {
      try {
        const res = await fetch(
          `${getDataNodeServer()}/batches/source/${encodeURIComponent(name)}/config`,
          { next: { revalidate: 300 }, signal: AbortSignal.timeout(5_000) }
        )
        if (res.ok) return res.json()
      } catch {}
      return null
    })
  )
  for (const data of results) {
    if (data && (data.markets ?? []).length > 0) return data
  }
  return { markets: [] }
}

/** Prefetch active batches from issuer — lightweight version without on-chain verification. */
export async function prefetchBatches() {
  const res = await fetch(`${getIssuerVisionUrl()}/vision/batches`, {
    next: { revalidate: 10 },
    signal: AbortSignal.timeout(5_000),
  })
  if (!res.ok) throw new Error(`Batches HTTP ${res.status}`)
  const data = await res.json()
  const raw: any[] = data.batches ?? (Array.isArray(data) ? data : [])
  // Deduplicate: latest non-paused batch per source
  const bySource = new Map<string, any>()
  for (const b of raw.filter((x: any) => !x.paused).sort((a: any, z: any) => z.id - a.id)) {
    const sid = b.source_id ?? b.sourceId ?? ''
    if (!bySource.has(sid)) bySource.set(sid, b)
  }
  return Array.from(bySource.values()).map((b: any) => ({
    id: b.id,
    creator: b.creator ?? '',
    sourceId: b.source_id ?? b.sourceId ?? '',
    configHash: b.config_hash ?? b.configHash ?? '',
    marketIds: b.market_ids ?? b.marketIds ?? [],
    resolutionTypes: b.resolution_types ?? b.resolutionTypes ?? [],
    tickDuration: b.tick_duration ?? b.tickDuration ?? 0,
    marketCount: b.market_count ?? b.marketCount ?? (b.market_ids ?? b.marketIds ?? []).length,
    playerCount: b.player_count ?? b.playerCount ?? 0,
    tvl: b.tvl ?? '0',
    currentTick: b.current_tick ?? b.currentTick ?? 0,
    paused: b.paused ?? false,
  }))
}

/** Prefetch active rounds for a source from issuer. */
export async function prefetchRounds(sourceId: string) {
  const res = await fetch(`${getIssuerVisionUrl()}/vision/rounds/active`, {
    next: { revalidate: 5 },
    signal: AbortSignal.timeout(5_000),
  })
  if (!res.ok) throw new Error(`Rounds HTTP ${res.status}`)
  const data = await res.json()
  const rounds: any[] = data.rounds ?? (Array.isArray(data) ? data : [])
  return rounds
    .filter((r: any) => {
      const sid = (r.source_id ?? r.sourceId ?? '').toLowerCase()
      return sid === sourceId.toLowerCase()
    })
    .map((r: any) => ({
      batchId: r.batchId ?? r.batch_id ?? r.id,
      sourceId: r.sourceId ?? r.source_id ?? '',
      status: r.status ?? 'betting',
      playerCount: r.playerCount ?? r.player_count ?? 0,
      tvl: r.tvl ?? '0',
      bettingEnd: r.bettingEnd ?? r.betting_end ?? null,
      settledAt: r.settledAt ?? r.settled_at ?? null,
      marketCount: r.marketCount ?? r.market_count ?? 0,
      timeframeSecs: r.timeframeSecs ?? r.timeframe_secs ?? 0,
    }))
}

// ── Source Registry (SWR-based, returned as plain data) ──
function sanitizeSource(s: Record<string, unknown>) {
  return {
    ...s,
    internalIds: (s.internalIds as string[])?.length > 0 ? s.internalIds : [s.sourceId],
    name: String(s.name ?? '').replace(/[<>]/g, ''),
    description: String(s.description ?? '').replace(/[<>]/g, ''),
    brandBg: /^(#[0-9A-Fa-f]{3,8}|linear-gradient\(.+\))$/.test(s.brandBg as string) ? s.brandBg : '#888',
    logo: /^\/(source-imgs|logos)\/[\w.-]+\.(svg|png|webp)$/.test(s.logo as string) ? s.logo : '/source-imgs/default.png',
  }
}

export async function prefetchSourceRegistry() {
  const res = await fetch(`${getDataNodeServer()}/sources/registry`, {
    next: { revalidate: 120 },
    signal: AbortSignal.timeout(5_000),
  })
  if (!res.ok) return { sources: [], categories: [] }
  const data = await res.json()
  const sources = (data.sources ?? [])
    .filter((s: Record<string, unknown>) => s.batchEligible === true)
    .map(sanitizeSource)
  return { sources, categories: data.categories ?? [] }
}
