// Coin map loaded lazily from /coin-map.json — entries have { id, image }
let coinMapCache: Record<string, { id: string; image: string }> | null = null
let coinMapPromise: Promise<void> | null = null

function ensureCoinMap(): void {
  if (coinMapCache || typeof window === 'undefined') return
  if (!coinMapPromise) {
    coinMapPromise = fetch('/coin-map.json')
      .then(r => r.ok ? r.json() : {})
      .then(data => { coinMapCache = data })
      .catch(() => { coinMapCache = {} })
  }
}

// Kick off the fetch at module load time (client only)
if (typeof window !== 'undefined') ensureCoinMap()

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
