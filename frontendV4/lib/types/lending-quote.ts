/**
 * Types for the Curator Quote API (intent-based lending)
 */

/** Quote request sent to curator */
export interface QuoteRequest {
  itpAddress: string
  collateralAmount: string
  borrowAmount: string
}

/** Quote response from curator */
export interface QuoteResponse {
  quoteId: string
  expiresAt: number
  terms: QuoteTerms
  market: QuoteMarket
  oracleUpdate: OracleUpdate
  bundler: BundlerData
}

/** Loan terms in the quote */
export interface QuoteTerms {
  borrowRate: string
  healthFactor: string
  liquidationPrice: string
  maxBorrow: string
}

/** Market information in the quote */
export interface QuoteMarket {
  marketId: string
  lltv: string
  oracleAddress: string
  currentOraclePrice: string
}

/** Oracle update data for the bundler */
export interface OracleUpdate {
  price: string
  timestamp: number
  cycleNumber: number
  blsSignature: string
  signersBitmask: string
  alreadyFresh: boolean
}

/** Bundler transaction data */
export interface BundlerData {
  to: string
  data: string
  description: string
  steps: string[]
}

/** Crisis level from health monitor */
export type CrisisLevel = 'Normal' | 'Elevated' | 'Stress' | 'Emergency'

/** Quote API error response */
export interface QuoteErrorResponse {
  error: string
  code: 'MARKET_NOT_FOUND' | 'INSUFFICIENT_COLLATERAL' | 'MARKET_FROZEN' | 'ORACLE_UNAVAILABLE' | 'RATE_LIMITED' | 'INVALID_REQUEST'
  retryAfter?: number
}
