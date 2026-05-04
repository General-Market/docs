import type { SourceFeed } from './types'
import { DEFAULT_RESOLUTION, fetchJsonWithTimeout } from './types'

/**
 * Equities feed — US market index (SPY proxy) via Finnhub.
 * Backed by an external provider (env: EQUITIES_API_KEY); the adapter does not
 * surface the provider name anywhere in the UI. The pill says "Anti-Cheat" because
 * the on-chain markets that reference equity data settle through the BLS-verified
 * oracle pipeline. The price feed itself is just a chart. No key, no series.
 */

type Candle = {
  c?: number[] // close
  s?: string  // 'ok' | 'no_data'
}

const SYMBOL = 'SPY'

export async function getEquitiesFeed(): Promise<SourceFeed> {
  const key = process.env.EQUITIES_API_KEY
  let series: number[] = []
  let meta = 'NYSE-listed · pre-market + close'
  let last: number | undefined

  if (key) {
    const now = Math.floor(Date.now() / 1000)
    const dayAgo = now - 60 * 60 * 24
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${SYMBOL}&resolution=15&from=${dayAgo}&to=${now}&token=${key}`
    const data = await fetchJsonWithTimeout<Candle>(url, 5000)
    if (data?.s === 'ok' && data.c && data.c.length > 1) {
      series = data.c.slice(-DEFAULT_RESOLUTION)
      last = series[series.length - 1]
      if (typeof last === 'number') {
        meta = `S&P 500 · $${last.toFixed(2)}`
      }
    }
  }

  return {
    sourceId: 'equities',
    displayName: 'NYSE',
    assetName: SYMBOL,
    assetValue: typeof last === 'number' ? `$${last.toFixed(2)}` : undefined,
    meta,
    coverage: 'anticheat',
    series,
  }
}
