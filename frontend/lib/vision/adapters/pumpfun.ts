import type { SourceFeed } from './types'
import { fetchJsonWithTimeout } from './types'

/**
 * Pumpfun — pump.fun's public coin endpoint returns recent launches with
 * current market caps. It's not a time-series; ranking caps and plotting
 * them is a fake curve. We surface the newest coin and its cap; chart absent.
 */

type PumpCoin = {
  mint?: string
  symbol?: string
  name?: string
  market_cap?: number
  usd_market_cap?: number
  reply_count?: number
  created_timestamp?: number
}

export async function getPumpfunFeed(): Promise<SourceFeed> {
  const data = await fetchJsonWithTimeout<PumpCoin[]>(
    'https://frontend-api.pump.fun/coins?offset=0&limit=50&sort=created_timestamp&order=DESC',
    5000,
    { headers: { Accept: 'application/json' } },
  )

  let meta = 'Solana memecoin launches'
  if (data && data.length > 0) {
    meta = `${data.length} fresh launches · last hour`
  }

  const top = data && data.length > 0 ? data[0] : undefined
  const topLabel = top?.symbol ?? top?.name
  const topCap = Number(top?.usd_market_cap ?? top?.market_cap ?? 0)
  return {
    sourceId: 'pumpfun',
    displayName: 'Pumpfun',
    assetName: topLabel ? `$${topLabel}` : 'Newest coin',
    assetValue: topCap > 0 ? `$${formatBig(topCap)}` : undefined,
    meta,
    coverage: 'external',
    series: [],
    external: true,
  }
}

function formatBig(n: number): string {
  if (n >= 1e9) return (n / 1e9).toFixed(1) + 'B'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k'
  return n.toFixed(0)
}
