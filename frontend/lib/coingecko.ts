import { loadCoinMap } from './static-cache'

let coinMapCache: Record<string, { id: string; image: string }> | null = null

if (typeof window !== 'undefined') {
  loadCoinMap().then(map => { coinMapCache = map })
}

/**
 * Get CoinGecko URL for a token symbol.
 * Returns direct coin page if ID is known, otherwise search URL.
 */
export function getCoinGeckoUrl(symbol: string): string {
  const entry = coinMapCache?.[symbol.toUpperCase()]
  if (entry?.id) {
    return `https://www.coingecko.com/en/coins/${entry.id}`
  }
  return `https://www.coingecko.com/en/search?query=${encodeURIComponent(symbol)}`
}
