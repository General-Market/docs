// Types shared between API route, server fetch, and client components

export interface CoinMapEntry {
  id: string    // coingecko_id
  image: string // CoinGecko CDN URL
}

export interface FounderInfo {
  name: string
  role: string
  age_value?: number
  age_status?: string
  gender: string
  nationality: string
  university?: string
  linkedin?: string
}

export interface CompanyFounderData {
  name: string
  coingecko_id?: string
  launch_year?: number
  protocol_age_years?: number
  ath_price?: number
  ath_date?: string
  ath_drawdown_pct?: number
  current_market_cap?: number
  founders: FounderInfo[]
}

export interface EnrichedHolding {
  symbol: string
  name: string
  weight: number
  price: number
  image?: string
  coingecko_id?: string
  market_cap?: number
  tvl?: number
  tvl_change_1d?: number
  tvl_change_7d?: number
  defi_category?: string
  raises?: {
    round: string
    amount_m: number
    valuation_m?: number
    date?: string
    lead_investors: string[]
  }[]
}

export interface FounderAggregates {
  total_founders: number
  total_companies_matched: number
  age_distribution: { bucket: string; count: number }[]
  gender_split: { label: string; count: number }[]
  top_nationalities: { label: string; count: number }[]
  top_universities: { label: string; count: number }[]
}

export interface DefiAggregates {
  total_tvl: number
  avg_tvl_change_7d: number
  protocols_with_data: number
  total_holdings: number
  top_by_tvl: { symbol: string; name: string; tvl: number; change_1d?: number; change_7d?: number }[]
}

export interface FundingAggregates {
  total_raised_m: number
  avg_valuation_m: number
  total_rounds: number
  top_investors: { name: string; count: number }[]
  recent_raises: { project: string; round: string; amount_m: number; lead: string; date?: string }[]
}

export interface ItpEnrichment {
  itpId: string
  holdings: EnrichedHolding[]
  founders?: FounderAggregates
  defi?: DefiAggregates
  funding?: FundingAggregates
}
