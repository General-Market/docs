import type { SourceFeed } from './types'
import { DEFAULT_RESOLUTION, fallbackSeries, fetchJsonWithTimeout } from './types'

/**
 * Equities feed — US market index (SPY proxy).
 * Backed by an external provider (env: EQUITIES_API_KEY); the adapter does not
 * surface the provider name anywhere in the UI. The pill says "Anti-Cheat" because
 * the on-chain markets that reference equity data settle through the BLS-verified
 * oracle pipeline. The price feed itself is just a chart.
 */

type Candle = {
  c?: number[] // close
  s?: string  // 'ok' | 'no_data'
}

const SYMBOL = 'SPY'

export async function getEquitiesFeed(): Promise<SourceFeed> {
  const key = process.env.EQUITIES_API_KEY
  let series: number[]
  let meta = 'NYSE-listed · pre-market + close'

  if (key) {
    const now = Math.floor(Date.now() / 1000)
    const dayAgo = now - 60 * 60 * 24
    const url = `https://finnhub.io/api/v1/stock/candle?symbol=${SYMBOL}&resolution=15&from=${dayAgo}&to=${now}&token=${key}`
    const data = await fetchJsonWithTimeout<Candle>(url, 5000)
    if (data?.s === 'ok' && data.c && data.c.length > 1) {
      const tail = data.c.slice(-DEFAULT_RESOLUTION)
      series = tail
      const last = tail[tail.length - 1]
      if (typeof last === 'number') {
        meta = `S&P 500 · $${last.toFixed(2)}`
      }
    } else {
      series = fallbackSeries('equities', DEFAULT_RESOLUTION, 0.55, 8, 4)
    }
  } else {
    series = fallbackSeries('equities', DEFAULT_RESOLUTION, 0.55, 8, 4)
  }

  return {
    sourceId: 'equities',
    displayName: 'NYSE',
    meta,
    coverage: 'anticheat',
    series,
  }
}
