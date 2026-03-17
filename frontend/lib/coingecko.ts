// Coin map loaded lazily from /coin-map.json — entries have { id, image }
let coinMapCache: Record<string, { id: string; image: string }> | null = null
let coinMapPromise: Promise<Record<string, { id: string; image: string }>> | null = null

function ensureCoinMap(): Promise<Record<string, { id: string; image: string }>> {
  if (coinMapCache) return Promise.resolve(coinMapCache)
  if (typeof window === 'undefined') return Promise.resolve({})
  if (!coinMapPromise) {
    coinMapPromise = fetch('/coin-map.json')
      .then(r => r.ok ? r.json() : {})
      .then(data => { coinMapCache = data; return data })
      .catch(() => { coinMapCache = {}; return {} })
  }
  return coinMapPromise
}

// Kick off the fetch at module load time (client only)
if (typeof window !== 'undefined') ensureCoinMap()

/**
 * Get the shared coin map. Returns cached data or waits for the single in-flight fetch.
 * Use this instead of fetching /coin-map.json independently.
 */
export function getCoinMap(): Promise<Record<string, { id: string; image: string }>> {
  return ensureCoinMap()
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
