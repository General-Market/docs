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
  ['reddit_', 'reddit', 'Reddit'],
  ['esport_', 'esports', 'Esports'],
  ['sport_', 'sports', 'Sports'],
  ['cb_model_', 'chaturbate', 'Chaturbate'],
  ['usgs_water_', 'usgs_water', 'USGS Water'],
  ['noaa_tide_', 'noaa_tides', 'NOAA Tides'],
  ['nrc_', 'nrc_nuclear', 'NRC Nuclear'],
  ['citybikes_', 'citybikes', 'CityBikes'],
  ['court_', 'courtlistener', 'Federal Courts'],
  ['ndbc_', 'ndbc', 'NDBC Buoys'],
  ['noaa_met_', 'noaa_met', 'NOAA Ocean Met'],
  ['nwps_', 'nwps', 'River Gauges'],
  ['airnow_', 'airnow', 'Air Quality'],
  ['hn_', 'hackernews', 'HackerNews'],
  ['defi_', 'defi', 'DeFi'],
  ['futures_', 'futures', 'Futures'],
  ['steam_', 'steam', 'Steam'],
  ['github_', 'github', 'GitHub'],
  ['tmdb_', 'tmdb', 'Movies/TV/Celebrities'],
  ['lastfm_', 'lastfm', 'Last.fm Music'],
  ['zillow_', 'zillow', 'Real Estate'],
  ['openalex_', 'openalex', 'OpenAlex'],
  ['crossref_', 'crossref', 'Crossref'],
  ['pubmed_', 'pubmed', 'PubMed'],
  ['stackexchange_', 'stackexchange', 'StackOverflow'],
  ['shelter_', 'shelter', 'Shelters'],
  ['parking_', 'parking', 'Parking'],
  ['tomtom_traffic_', 'tomtom_traffic', 'Traffic Flow'],
  ['tomtom_evcharge_', 'tomtom_evcharge', 'EV Charging'],
  ['bgg_', 'bgg', 'Board Games'],
  ['bestbuy_', 'bestbuy', 'Best Buy'],
  ['adzuna_', 'adzuna', 'Adzuna Jobs'],
  ['queue_times_', 'queue_times', 'Theme Parks'],
  ['cbp_border_', 'cbp_border', 'Border Wait Times'],
  ['faa_delays_', 'faa_delays', 'Airport Delays'],
  ['db_trains_', 'db_trains', 'Deutsche Bahn'],
  ['mcbroken_', 'mcbroken', 'McBroken'],
  ['nyc311_', 'nyc311', 'NYC 311'],
]

// Common bare crypto tickers (no prefix)
const BARE_CRYPTO = new Set([
  'btc', 'eth', 'sol', 'bnb', 'xrp', 'doge', 'ada', 'avax', 'dot', 'link',
  'matic', 'uni', 'aave', 'mkr', 'comp', 'snx', 'crv', 'sushi', 'yfi',
])

const CATEGORY_ORDER = [
  'crypto', 'stocks', 'futures', 'defi', 'polymarket',
  'weather', 'esports', 'sports', 'twitch', 'reddit', 'chaturbate',
  'usgs_water', 'noaa_tides', 'nrc_nuclear', 'citybikes',
  'ndbc', 'noaa_met', 'nwps', 'airnow', 'courtlistener', 'nyc311',
  'hackernews', 'steam', 'github', 'tmdb', 'lastfm', 'zillow',
  'openalex', 'crossref', 'pubmed', 'stackexchange',
  'shelter',
  'parking', 'tomtom_traffic', 'tomtom_evcharge',
  'bgg', 'bestbuy',
  'adzuna',
  'queue_times', 'cbp_border', 'faa_delays', 'db_trains',
  'mcbroken',
  'other',
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
