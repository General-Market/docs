/**
 * Polymarket vs Vision — per-market comparison from the last settled batch.
 *
 * Aggregates three feeds:
 *   1. Latest settled batch for the polymarket source (issuer).
 *   2. Per-market settlement ratios for that batch (issuer).
 *   3. Polymarket implied-prob history within the batch window (data-node).
 *
 * Returns one row per active market with both sides of the same window:
 *   — Polymarket: implied-prob delta during the 5-minute betting window.
 *   — Vision:    winner multiplier and % gain on that side from the parimutuel pool.
 *
 * The contrast is the point: prices barely twitch, payouts erupt.
 */
import { getDataNodeServer, getIssuerVisionUrl } from '@/lib/config'

const SOURCE_ID = 'polymarket'
const MAX_MARKETS = 250
// The data-node tolerates ~8 concurrent connections cleanly. Higher counts
// surface as partial responses where some markets get empty history under
// connection-pool pressure.
const HISTORY_CONCURRENCY = 8
const HISTORY_PAD_MS = 60_000
// Match Vision's window exactly — apples-to-apples on time. Most Polymarket
// markets will read flat over five minutes because Polymarket samples slower
// than that. That zero, next to Vision's multiplier, is the comparison.

interface BatchHistoryItem {
  batchId: number
  bettingStart?: string | null
  bettingEnd?: string | null
  settledAt?: string | null
  totalPool?: number
  playerCount?: number
  status?: string
}

interface RatioMarket {
  assetId: string
  outcome: 'Up' | 'Down' | 'Flat' | 'Cancelled' | 'AllSameSide' | 'AllLosers'
  upStake: string
  downStake: string
  upPct?: number
  downPct?: number
  pctChangeBps?: number
  settledAt?: string
}

interface RatiosResponse {
  batchId: number
  markets: RatioMarket[]
}

interface SnapshotPrice {
  source: string
  assetId: string
  name?: string | null
  symbol?: string | null
  value?: string | number | null
  volume24h?: string | number | null
}

interface HistoryPoint {
  fetchedAt: string
  createdAt?: string
  value: string | number
}

interface ComparisonMarket {
  assetId: string
  name: string
  /** Polymarket implied probability at start of betting window, in [0, 1]. */
  polyStart: number | null
  /** Polymarket implied probability at end of betting window, in [0, 1]. */
  polyEnd: number | null
  /** % change of Polymarket implied probability across the window. */
  polyChangePct: number | null
  /** Current Polymarket implied probability from latest snapshot. */
  polyCurrent: number | null
  /** 24h volume from snapshot, if known. */
  polyVolume24h: number | null
  /** Outcome reported by Vision oracles. */
  visionOutcome: RatioMarket['outcome']
  /** Pool side that won, if any. */
  visionWinSide: 'Up' | 'Down' | null
  /** % change of the underlying asset across the Vision betting window, in basis points
   *  (1 bp = 0.01%). When zero, the oracle resolved Up/Down on a tiebreak — the
   *  market did not actually move. */
  visionPctChangeBps: number
  /** True when Vision called a winner but the underlying did not move (pctChangeBps=0). */
  visionTieBroken: boolean
  /** Pool size on Up side, in human USDC (L3 18-dec). */
  visionUpPool: number
  /** Pool size on Down side, in human USDC (L3 18-dec). */
  visionDownPool: number
  /** Total pool, in human USDC. */
  visionTotalPool: number
  /** Winner multiplier = totalPool / winnerPool. Null when no winner-side stake. */
  visionMultiplier: number | null
  /** Net % gain on the winner = (mult - 1) × 100. */
  visionGainPct: number | null
  /** Absolute gap = |visionGainPct − polyChangePct|. Null when either is unknown. */
  leverageGap: number | null
}

interface ComparisonResponse {
  batch: {
    id: number
    bettingStart: string | null
    bettingEnd: string | null
    settledAt: string | null
    totalPool: number
    playerCount: number
    activeMarketCount: number
    totalSettled: number
  } | null
  markets: ComparisonMarket[]
  /** Aggregate framing for the headline. */
  summary: {
    avgPolyChangePct: number | null
    avgVisionGainPct: number | null
    biggestVisionGainPct: number | null
    biggestLeverageGap: number | null
  }
  generatedAt: string
  source: 'live' | 'partial' | 'empty'
}

function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string') {
    const n = parseFloat(v)
    return Number.isFinite(n) ? n : null
  }
  return null
}

function pickPointNear(points: HistoryPoint[], targetMs: number, prefer: 'before' | 'after'): HistoryPoint | null {
  if (points.length === 0) return null
  let best: HistoryPoint | null = null
  let bestDelta = Infinity
  for (const p of points) {
    const t = new Date(p.fetchedAt ?? p.createdAt ?? 0).getTime()
    if (!Number.isFinite(t)) continue
    if (prefer === 'before' && t > targetMs + 30_000) continue
    if (prefer === 'after' && t < targetMs - 30_000) continue
    const delta = Math.abs(t - targetMs)
    if (delta < bestDelta) {
      bestDelta = delta
      best = p
    }
  }
  if (best) return best
  // No directional match — fall back to nearest of any kind.
  let nearest: HistoryPoint | null = null
  let nearestDelta = Infinity
  for (const p of points) {
    const t = new Date(p.fetchedAt ?? p.createdAt ?? 0).getTime()
    if (!Number.isFinite(t)) continue
    const delta = Math.abs(t - targetMs)
    if (delta < nearestDelta) {
      nearestDelta = delta
      nearest = p
    }
  }
  return nearest
}

async function fetchJson<T>(url: string, timeoutMs = 8_000): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(timeoutMs) })
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

async function runWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length)
  let cursor = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++
      if (i >= items.length) return
      out[i] = await fn(items[i])
    }
  })
  await Promise.all(workers)
  return out
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const limit = Math.max(20, Math.min(MAX_MARKETS, parseInt(url.searchParams.get('limit') ?? '150', 10) || 150))

  const issuerBase = getIssuerVisionUrl()
  const dataNodeBase = getDataNodeServer()

  const historyResp = await fetchJson<{ batches: BatchHistoryItem[]; totalSettled?: number }>(
    `${issuerBase}/vision/source/${SOURCE_ID}/history?page=1&per_page=1`,
  )
  const latest = historyResp?.batches?.[0]
  if (!latest || !latest.batchId) {
    const empty: ComparisonResponse = {
      batch: null,
      markets: [],
      summary: { avgPolyChangePct: null, avgVisionGainPct: null, biggestVisionGainPct: null, biggestLeverageGap: null },
      generatedAt: new Date().toISOString(),
      source: 'empty',
    }
    return Response.json(empty)
  }

  const batchId = latest.batchId
  const bettingStartMs = latest.bettingStart ? new Date(latest.bettingStart).getTime() : 0
  const bettingEndMs = latest.bettingEnd ? new Date(latest.bettingEnd).getTime() : 0
  const totalSettled = historyResp?.totalSettled ?? 0

  const [ratios, snapshot] = await Promise.all([
    fetchJson<RatiosResponse>(`${issuerBase}/vision/batch/${batchId}/ratios`, 12_000),
    fetchJson<{ snapshots: SnapshotPrice[] }>(
      `${dataNodeBase}/vision/snapshot?source=${SOURCE_ID}&limit=10000`,
      12_000,
    ),
  ])

  if (!ratios || !ratios.markets) {
    const empty: ComparisonResponse = {
      batch: {
        id: batchId,
        bettingStart: latest.bettingStart ?? null,
        bettingEnd: latest.bettingEnd ?? null,
        settledAt: latest.settledAt ?? null,
        totalPool: latest.totalPool ?? 0,
        playerCount: latest.playerCount ?? 0,
        activeMarketCount: 0,
        totalSettled,
      },
      markets: [],
      summary: { avgPolyChangePct: null, avgVisionGainPct: null, biggestVisionGainPct: null, biggestLeverageGap: null },
      generatedAt: new Date().toISOString(),
      source: 'partial',
    }
    return Response.json(empty)
  }

  const snapshotMap = new Map<string, SnapshotPrice>()
  for (const s of snapshot?.snapshots ?? []) {
    if (s.assetId) snapshotMap.set(s.assetId.toLowerCase(), s)
  }

  // Polymarket asset IDs are bytes32 hex (66 chars including '0x'). Other prefixes
  // — e.g. `iss_latitude` — are bitmap-slot leftovers from earlier sources and
  // do not belong to this comparison.
  const isPolymarketAssetId = (id: string) => /^0x[0-9a-f]{64}$/i.test(id)

  const active = ratios.markets
    .filter((m) => isPolymarketAssetId(m.assetId))
    .map((m) => {
      let up = 0n
      let down = 0n
      try {
        up = BigInt(m.upStake ?? '0')
        down = BigInt(m.downStake ?? '0')
      } catch {}
      return { m, up, down, total: up + down }
    })
    .filter((x) => x.total > 0n)
    .sort((a, b) => (a.total > b.total ? -1 : a.total < b.total ? 1 : 0))
    .slice(0, limit)

  // Vision's betting window itself. We sample Polymarket implied probability
  // at the same start and end and compute the delta. A small pad either side
  // gives the nearest-point picker something to grab when Polymarket's last
  // tick sits just outside the window.
  const polyStartTargetMs = bettingStartMs
  const polyEndTargetMs = bettingEndMs
  const fromIso = new Date(polyStartTargetMs - HISTORY_PAD_MS).toISOString()
  const toIso = new Date(polyEndTargetMs + HISTORY_PAD_MS).toISOString()

  const histories = await runWithConcurrency(active, HISTORY_CONCURRENCY, async ({ m }) => {
    const r = await fetchJson<{ prices: HistoryPoint[] }>(
      `${dataNodeBase}/market/prices/${SOURCE_ID}/${encodeURIComponent(m.assetId)}/history?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`,
      15_000,
    )
    return r?.prices ?? []
  })

  const markets: ComparisonMarket[] = active.map((entry, i) => {
    const { m, up, down, total } = entry
    const points = histories[i] ?? []
    const startPt = pickPointNear(points, polyStartTargetMs, 'before')
    const endPt = pickPointNear(points, polyEndTargetMs, 'after')
    const polyStart = toNumber(startPt?.value)
    const polyEnd = toNumber(endPt?.value)
    const polyChangePct = polyStart != null && polyEnd != null && polyStart > 0
      ? ((polyEnd - polyStart) / polyStart) * 100
      : null

    const snap = snapshotMap.get(m.assetId.toLowerCase())
    const polyCurrent = toNumber(snap?.value)
    const polyVolume24h = toNumber(snap?.volume24h)

    const totalNum = Number(total) / 1e18
    const upNum = Number(up) / 1e18
    const downNum = Number(down) / 1e18
    const winSide: 'Up' | 'Down' | null = m.outcome === 'Up' ? 'Up' : m.outcome === 'Down' ? 'Down' : null
    const winnerPool = winSide === 'Up' ? up : winSide === 'Down' ? down : 0n
    const visionMultiplier = winSide && winnerPool > 0n ? Number((total * 10000n) / winnerPool) / 10000 : null
    const visionGainPct = visionMultiplier != null ? (visionMultiplier - 1) * 100 : null
    const visionPctChangeBps = Number(m.pctChangeBps ?? 0)
    const visionTieBroken = winSide !== null && visionPctChangeBps === 0
    const leverageGap = visionGainPct != null && polyChangePct != null ? Math.abs(visionGainPct - polyChangePct) : null

    return {
      assetId: m.assetId,
      name: (snap?.name as string) ?? m.assetId,
      polyStart,
      polyEnd,
      polyChangePct,
      polyCurrent,
      polyVolume24h,
      visionOutcome: m.outcome,
      visionWinSide: winSide,
      visionPctChangeBps,
      visionTieBroken,
      visionUpPool: upNum,
      visionDownPool: downNum,
      visionTotalPool: totalNum,
      visionMultiplier,
      visionGainPct,
      leverageGap,
    }
  })

  // Headline aggregates — restrict to markets where the underlying actually
  // moved on both sides. Tiebreaks where pctChangeBps=0 inflate Vision payouts
  // for what was, on the chain, a non-event. Excluding them keeps the marquee
  // numbers honest.
  const real = markets.filter(
    (r) => r.polyChangePct != null && r.visionGainPct != null && !r.visionTieBroken,
  )
  const avgPolyChangePct = real.length > 0
    ? real.reduce((s, r) => s + Math.abs(r.polyChangePct!), 0) / real.length
    : null
  const avgVisionGainPct = real.length > 0
    ? real.reduce((s, r) => s + r.visionGainPct!, 0) / real.length
    : null
  const biggestVisionGainPct = real.reduce<number | null>((max, r) => {
    if (r.visionGainPct == null) return max
    return max == null || r.visionGainPct > max ? r.visionGainPct : max
  }, null)
  const biggestLeverageGap = real.reduce<number | null>((max, r) => {
    if (r.leverageGap == null) return max
    return max == null || r.leverageGap > max ? r.leverageGap : max
  }, null)

  const response: ComparisonResponse = {
    batch: {
      id: batchId,
      bettingStart: latest.bettingStart ?? null,
      bettingEnd: latest.bettingEnd ?? null,
      settledAt: latest.settledAt ?? null,
      totalPool: latest.totalPool ?? 0,
      playerCount: latest.playerCount ?? 0,
      activeMarketCount: active.length,
      totalSettled,
    },
    markets,
    summary: { avgPolyChangePct, avgVisionGainPct, biggestVisionGainPct, biggestLeverageGap },
    generatedAt: new Date().toISOString(),
    source: 'live',
  }

  return Response.json(response, { headers: { 'Cache-Control': 'public, s-maxage=20, stale-while-revalidate=60' } })
}
