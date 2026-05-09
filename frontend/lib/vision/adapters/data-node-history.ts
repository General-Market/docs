// Data-node bridge for home-card sparklines.
//
// The data-node already records every source's per-asset price stream.
// We pull the live top asset, then fetch its 7-day history and hand the
// home card a real number[] series. No interpolation, no synthesis —
// if upstream has no points, we return an empty series and the card
// renders without a curve. Honesty over decoration.

import { getAaDataNodeUrl } from '@/lib/config'

const DEFAULT_TIMEOUT = 5000
const REVALIDATE_SEC = 600

type DataNodeAsset = {
  assetId: string
  name?: string
  symbol?: string
  value?: string | number | null
  volume24h?: string | number | null
  changePct?: string | number | null
}

type PricesResponse = {
  prices?: DataNodeAsset[]
  total?: number
}

type HistoryResponse = {
  count?: number
  prices?: { value?: string | number; fetchedAt?: string }[]
}

async function fetchJson<T>(url: string, ms = DEFAULT_TIMEOUT): Promise<T | null> {
  try {
    const ctl = new AbortController()
    const timer = setTimeout(() => ctl.abort(), ms)
    const res = await fetch(url, {
      signal: ctl.signal,
      headers: { Accept: 'application/json' },
      next: { revalidate: REVALIDATE_SEC },
    })
    clearTimeout(timer)
    if (!res.ok) return null
    return (await res.json()) as T
  } catch {
    return null
  }
}

function toNumber(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined) return null
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : null
}

export type PickedSeries = {
  asset: DataNodeAsset
  series: number[]
  last: number | null
  /** Total assets the data-node tracks for this source — what the platform lists. */
  total: number
}

/** Fetch the count of markets the platform tracks for a source. */
export async function fetchSourceMarketCount(source: string): Promise<number> {
  const base = getAaDataNodeUrl()
  const data = await fetchJson<PricesResponse>(
    `${base}/market/prices/${encodeURIComponent(source)}?limit=1`,
  )
  return data?.total ?? 0
}

export function formatMarketCount(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K markets`
  return `${n.toLocaleString()} market${n === 1 ? '' : 's'}`
}

export interface PickOptions {
  /** How many candidates to fetch from /market/prices. */
  limit?: number
  /** Sort key — `'value'` (default) for star/viewer/player counts, `'volume24h'` for prediction markets. */
  rankBy?: 'value' | 'volume24h'
  /** Pin a specific asset by id; if it has history AND moves, win. Else fall back to ranking. */
  preferredAssetId?: string
  /** Minimum number of history points required for a candidate to win. */
  minPoints?: number
  /** Cap the returned series length. */
  maxSeriesPoints?: number
  /** Filter assets before ranking. Skip ones with bad shape. */
  filter?: (asset: DataNodeAsset) => boolean
  /**
   * Number of candidates to probe in parallel for history. Higher = better
   * chance of finding a non-flat one, more bandwidth at cache-miss. Default 8.
   */
  probeLimit?: number
  /**
   * Reject series whose liveliness score is below this. Liveliness =
   * sum(|diff|) / max(|max|, |min|) — total path length normalized by scale.
   * A flat line scores 0; a monotone climb scores ~range/scale; a wiggly
   * mean-reverting series scores far higher. Default 0.01 (1%).
   */
  minLiveliness?: number
}

/** Total path traveled relative to scale. Captures both "moves" and "wiggles". */
function liveliness(series: number[]): number {
  if (series.length < 2) return 0
  let path = 0
  let min = series[0]
  let max = series[0]
  for (let i = 1; i < series.length; i++) {
    path += Math.abs(series[i] - series[i - 1])
    if (series[i] < min) min = series[i]
    if (series[i] > max) max = series[i]
  }
  const scale = Math.max(Math.abs(max), Math.abs(min))
  if (scale < 1e-12) return 0
  return path / scale
}

/**
 * Pick a representative asset from a data-node source and return its history.
 *
 * Strategy: rank candidates by the chosen key (descending), probe several in
 * parallel for history, then pick the most *alive* one — most path traveled
 * per unit scale. Flat lines (no movement) and slow monotone drifts both
 * score low; mean-reverting volatile series score high. Pinned assets
 * (AAPL, CS2) only win when they actually move; otherwise the ranker takes
 * over. If every candidate is flat, fall back to the top-ranked one with
 * enough depth — better a flat real chart than an empty card.
 */
export async function pickSourceSeries(
  source: string,
  opts: PickOptions = {},
): Promise<PickedSeries | null> {
  const {
    limit = 200,
    rankBy = 'value',
    preferredAssetId,
    minPoints = 8,
    maxSeriesPoints = 64,
    filter,
    probeLimit = 8,
    minLiveliness = 0.01,
  } = opts

  const base = getAaDataNodeUrl()

  // Fetch the pinned asset out-of-band so it can win even if it lex-sorts
  // outside the top `limit` of the listing. The data-node's listing is
  // alphabetical by assetId; popular assets (e.g. steam_game_730) hide late.
  const [list, pinnedAsset] = await Promise.all([
    fetchJson<PricesResponse>(`${base}/market/prices/${encodeURIComponent(source)}?limit=${limit}`),
    preferredAssetId
      ? fetchJson<DataNodeAsset>(
          `${base}/market/prices/${encodeURIComponent(source)}/${encodeURIComponent(preferredAssetId)}`,
        )
      : Promise.resolve<DataNodeAsset | null>(null),
  ])

  const all = list?.prices ?? []
  if (all.length === 0 && !pinnedAsset) return null

  const rank = (a: DataNodeAsset): number => {
    const v = toNumber(rankBy === 'volume24h' ? a.volume24h : a.value)
    return v ?? 0
  }

  let candidates = filter ? all.filter(filter) : all
  candidates = [...candidates].sort((a, b) => rank(b) - rank(a))

  if (pinnedAsset && pinnedAsset.assetId) {
    candidates = [pinnedAsset, ...candidates.filter((c) => c.assetId !== pinnedAsset.assetId)]
  }

  const probed = candidates.slice(0, Math.min(candidates.length, probeLimit))
  const probes = await Promise.allSettled(
    probed.map(async (c) => {
      const hist = await fetchJson<HistoryResponse>(
        `${base}/market/prices/${encodeURIComponent(source)}/${encodeURIComponent(c.assetId)}/history`,
      )
      const pts = (hist?.prices ?? [])
        .map((p) => toNumber(p.value))
        .filter((v): v is number => v !== null && v > 0)
      return { c, pts }
    }),
  )

  type Accepted = {
    asset: DataNodeAsset
    series: number[]
    last: number | null
    score: number
    rankIndex: number
  }
  const accepted: Accepted[] = []
  probes.forEach((r, i) => {
    if (r.status !== 'fulfilled') return
    const { c, pts } = r.value
    if (pts.length < minPoints) return
    const series = pts.slice(-maxSeriesPoints)
    const last = series[series.length - 1] ?? null
    accepted.push({
      asset: c,
      series,
      last,
      score: liveliness(series),
      rankIndex: i,
    })
  })

  if (accepted.length === 0) return null

  // Prefer alive ones (score >= floor); among those, take the highest score.
  // If every probed candidate is flat, fall back to the top-ranked one so we
  // never regress to an empty card.
  const alive = accepted.filter((a) => a.score >= minLiveliness)
  const winner = alive.length > 0
    ? alive.reduce((best, a) => (a.score > best.score ? a : best))
    : accepted.reduce((best, a) => (a.rankIndex < best.rankIndex ? a : best))

  return {
    asset: winner.asset,
    series: winner.series,
    last: winner.last,
    total: list?.total ?? candidates.length,
  }
}

export function formatBigNumber(n: number): string {
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T'
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'
  return n.toFixed(0)
}

export function formatCount(n: number): string {
  return Math.round(n).toLocaleString()
}
