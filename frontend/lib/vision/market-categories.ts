export function getCategory(marketId: string, prefixes: Map<string, string>): string {
  for (const [prefix, category] of prefixes) {
    if (marketId.startsWith(prefix)) return category
  }
  return 'other'
}

export function formatMarketName(marketId: string, prefixes?: string[]): string {
  if (prefixes) {
    for (const prefix of prefixes) {
      if (marketId.startsWith(prefix)) return marketId.slice(prefix.length)
    }
  }
  return marketId.replace(/_/g, ' ')
}

// ── MarketCategory type + categorizeMarkets ────────────────────────────────────
// Used by MarketAccordion to group markets by category.

export interface MarketCategory {
  key: string
  label: string
  markets: string[]
}

// Simple prefix-based categorization. Categories loosely map source prefixes
// to human-readable groups. With no static registry, we derive from asset ID patterns.
const PREFIX_CATEGORIES: [RegExp, string, string][] = [
  [/^(btc|eth|sol|bnb|ada|xrp|dot|avax|matic|link|uni|aave|comp|mkr|crv|snx|sushi|yfi|1inch|bal|ren|lrc|enj|mana|sand|axs|gala|ilv|chr|alice|tlm|gmt|ape|imx|ldo|rpl|frax|spell|cvx|fxs|ohm|joe|time|wmemo|mim|crv|spell)/i, 'crypto', 'Crypto'],
  [/^(stocks?_|equity_|share_|nasdaq_|nyse_|sp500_|dowjones_|finnhub_)/i, 'stocks', 'Stocks'],
  [/^(defi_|tvl_|protocol_|chain_tvl|dex_)/i, 'defi', 'DeFi'],
  [/^(rates?_|fred_|treasury_|bond_|yield_|fed_|ecb_|bls_|cpi_|pce_|gdp_|unemployment_)/i, 'economic', 'Economic'],
  [/^(congress_|sec_|finra_|court_|legal_|law_)/i, 'regulatory', 'Regulatory'],
  [/^(github_|npm_|pypi_|crates_|package_|repo_|commit_)/i, 'tech', 'Tech'],
  [/^(twitch_|steam_|anilist_|tmdb_|lastfm_|backpacktf_|fourchan_)/i, 'entertainment', 'Entertainment'],
  [/^(weather_|earthquake_|volcano_|wildfire_|spaceweather_|solar_)/i, 'geophysical', 'Geophysical'],
  [/^(flight_|ship_|transit_|traffic_|mil_aircraft_|transport_)/i, 'transport', 'Transport'],
  [/^(ebird_|airquality_|shelter_|nature_)/i, 'nature', 'Nature'],
  [/^(iss_|space_|satellite_)/i, 'space', 'Space'],
  [/^(poly_|polymarket_)/i, 'prediction', 'Prediction'],
]


/**
 * Group a list of market IDs by category.
 * Falls back to 'other' for unrecognized prefixes.
 */
export function categorizeMarkets(marketIds: string[]): MarketCategory[] {
  const groups: Record<string, { label: string; markets: string[] }> = {}

  for (const id of marketIds) {
    let matched = false
    for (const [pattern, key, label] of PREFIX_CATEGORIES) {
      if (pattern.test(id)) {
        if (!groups[key]) groups[key] = { label, markets: [] }
        groups[key].markets.push(id)
        matched = true
        break
      }
    }
    if (!matched) {
      if (!groups['other']) groups['other'] = { label: 'Other', markets: [] }
      groups['other'].markets.push(id)
    }
  }

  // Sort by market count desc, other last
  return Object.entries(groups)
    .map(([key, { label, markets }]) => ({ key, label, markets }))
    .sort((a, b) => {
      if (a.key === 'other') return 1
      if (b.key === 'other') return -1
      return b.markets.length - a.markets.length
    })
}
