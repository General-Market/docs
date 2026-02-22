/**
 * Market categorization utility.
 * Groups market IDs by data-source prefix and provides display helpers.
 * Consolidates the duplicated `formatMarketName` across VisualTab/CompactVisualTab.
 */

export interface MarketCategory {
  key: string
  label: string
  markets: string[]
}

const PREFIX_MAP: [string, string, string][] = [
  // [prefix, categoryKey, displayLabel]
  ['crypto_', 'crypto', 'Crypto'],
  ['stock_', 'stocks', 'Stocks'],
  ['stocks_', 'stocks', 'Stocks'],
  ['poly_', 'polymarket', 'Polymarket'],
  ['weather_', 'weather', 'Weather'],
  ['twitch_', 'twitch', 'Twitch'],
  ['hn_', 'hackernews', 'HackerNews'],
  ['defi_', 'defi', 'DeFi'],
  ['futures_', 'futures', 'Futures'],
  ['steam_', 'steam', 'Steam'],
  ['github_', 'github', 'GitHub'],
  ['tmdb_', 'tmdb', 'Movies/TV'],
  ['zillow_', 'zillow', 'Real Estate'],
]

// Common bare crypto tickers (no prefix)
const BARE_CRYPTO = new Set([
  'btc', 'eth', 'sol', 'bnb', 'xrp', 'doge', 'ada', 'avax', 'dot', 'link',
  'matic', 'uni', 'aave', 'mkr', 'comp', 'snx', 'crv', 'sushi', 'yfi',
])

const CATEGORY_ORDER = [
  'crypto', 'stocks', 'futures', 'defi', 'polymarket',
  'weather', 'twitch', 'hackernews', 'steam', 'github', 'tmdb', 'zillow', 'other',
]

const LABEL_MAP: Record<string, string> = {}
for (const [, key, label] of PREFIX_MAP) {
  LABEL_MAP[key] = label
}
LABEL_MAP['other'] = 'Other'

/** Get category key for a market ID */
export function getCategory(marketId: string): string {
  const lower = marketId.toLowerCase()

  for (const [prefix, key] of PREFIX_MAP) {
    if (lower.startsWith(prefix)) return key
  }

  // Check bare crypto tickers (e.g., "BTC-USD", "ETH-USD")
  const base = lower.split('-')[0].split('_')[0]
  if (BARE_CRYPTO.has(base)) return 'crypto'

  return 'other'
}

/** Get display label for a category key */
export function getCategoryLabel(key: string): string {
  return LABEL_MAP[key] || key.charAt(0).toUpperCase() + key.slice(1)
}

/**
 * Group market IDs into ordered categories.
 * Returns only categories that have at least one market.
 */
export function categorizeMarkets(marketIds: string[]): MarketCategory[] {
  const groups: Record<string, string[]> = {}

  for (const id of marketIds) {
    const cat = getCategory(id)
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(id)
  }

  return CATEGORY_ORDER
    .filter(key => groups[key]?.length)
    .map(key => ({
      key,
      label: getCategoryLabel(key),
      markets: groups[key],
    }))
}

/** Format a market ID into a human-readable short name. */
export function formatMarketName(marketId: string): string {
  for (const [prefix] of PREFIX_MAP) {
    if (marketId.toLowerCase().startsWith(prefix)) {
      return marketId.slice(prefix.length).replace(/_/g, ' ')
    }
  }
  // Bare tickers like "BTC-USD" — keep as-is but uppercase
  return marketId.replace(/_/g, ' ').toUpperCase()
}
