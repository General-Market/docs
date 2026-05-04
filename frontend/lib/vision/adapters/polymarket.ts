import type { SourceFeed } from './types'
import { fetchJsonWithTimeout } from './types'

/**
 * Polymarket — public Gamma API gives current per-market volume. Sorting
 * those volumes is a ranking, not a time-series; rendering a curve from it
 * is a lie. We surface the top question and total live volume; chart absent.
 * The card is `external` because Polymarket's orderbook is not Anti-Cheat.
 */

type GammaMarket = {
  id?: string
  question?: string
  volume?: number | string
  liquidity?: number | string
}

export async function getPolymarketFeed(): Promise<SourceFeed> {
  const data = await fetchJsonWithTimeout<GammaMarket[]>(
    'https://gamma-api.polymarket.com/markets?active=true&closed=false&limit=20',
    5000,
  )

  let meta = 'Prediction markets · live volume'
  if (data && data.length > 0) {
    const total = data
      .map((m) => Number(m.volume ?? 0))
      .filter((v) => Number.isFinite(v) && v > 0)
      .reduce((a, b) => a + b, 0)
    if (total > 0) {
      meta = `${data.length} live markets · 24h $${formatBig(total)}`
    }
  }

  const top = data && data.length > 0 ? data[0] : undefined
  const topQuestion = top?.question ? truncate(top.question, 56) : undefined
  return {
    sourceId: 'polymarket',
    displayName: 'Polymarket',
    assetName: topQuestion ?? 'Top question',
    assetValue: top?.volume ? `$${formatBig(Number(top.volume))}` : undefined,
    meta,
    coverage: 'external',
    series: [],
    external: true,
  }
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + '…'
}

function formatBig(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'
  return n.toFixed(0)
}
