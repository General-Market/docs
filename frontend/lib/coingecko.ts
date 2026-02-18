import coingeckoIds from './coingecko-ids.json'

const idMap = coingeckoIds as Record<string, string>

/**
 * Get CoinGecko URL for a token symbol.
 * Returns direct coin page if ID is known, otherwise search URL.
 */
export function getCoinGeckoUrl(symbol: string): string {
  const id = idMap[symbol.toUpperCase()]
  if (id) {
    return `https://www.coingecko.com/en/coins/${id}`
  }
  return `https://www.coingecko.com/en/search?query=${encodeURIComponent(symbol)}`
}
