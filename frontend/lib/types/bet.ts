/**
 * Bet types with asymmetric odds support
 * Story 7-12: Update BetCard Component to Display Odds
 */

import { COLLATERAL_DECIMALS } from '@/lib/contracts/addresses'

/**
 * Trade horizon for position holding period
 * - short: Intraday or very short term (< 1 day)
 * - daily: Day trading (1 day)
 * - weekly: Swing trading (1 week)
 * - monthly: Position trading (1 month)
 * - quarterly: Long-term (3 months)
 */
export type TradeHorizon = 'short' | 'daily' | 'weekly' | 'monthly' | 'quarterly'

/** Threshold above which odds are considered favorable for matcher */
export const FAVORABLE_ODDS_THRESHOLD = 1.1
/** Threshold below which odds are considered unfavorable for matcher */
export const UNFAVORABLE_ODDS_THRESHOLD = 0.91
/** Default odds in basis points (1.00x) */
export const DEFAULT_ODDS_BPS = 10000

/**
 * Core Bet interface with odds support
 * oddsBps uses basis points: 10000 = 1.00x, 20000 = 2.00x
 * Epic 8: Added category-based betting fields
 */
export interface Bet {
  betId: string
  creator: string
  betHash: string
  jsonStorageRef?: string
  creatorStake: string        // WIND amount (18 decimals as string)
  oddsBps: number             // Basis points: 10000 = 1.00x
  status: 'pending' | 'matched' | 'settling' | 'settled'
  createdAt: string
  portfolioSize?: number
  tradeCount?: number         // Epic 8: Actual trade count from bet_trades table
  // Story 14-1: Single-filler model
  fillerAddress?: string      // Address of the filler (if matched)
  fillerStake?: string        // Filler's stake amount
  // Epic 8: Category-based betting
  categoryId?: string         // Category ID (e.g., 'crypto', 'predictions')
  listSize?: number           // List size (e.g., 100 for top 100)
  // Epic 9: Trade horizon for position holding period
  horizon?: TradeHorizon      // Trade horizon (short, daily, weekly, monthly, quarterly)
  // Story 14-1: Early exit support
  earlyExit?: boolean         // True if bet settled via early exit
}

/**
 * Computed odds display values for UI
 */
export interface OddsDisplay {
  /** Decimal odds (e.g., 2.0 for 2.00x) */
  decimal: number
  /** Display string (e.g., "2.00x") */
  display: string
  /** Creator risk formatted (e.g., "$100.00") */
  creatorRisk: string
  /** Matcher risk formatted (e.g., "$50.00") */
  matcherRisk: string
  /** Total pot formatted (e.g., "$150.00") */
  totalPot: string
  /** Creator return multiplier (e.g., "1.50x") */
  creatorReturn: string
  /** Matcher return multiplier (e.g., "3.00x") */
  matcherReturn: string
  /** Implied probability from odds (0-1) */
  impliedProbability: number
  /** Favorability for matcher */
  favorability: 'favorable' | 'even' | 'unfavorable'
  /** Whether the bet is matched (single-filler model) */
  isMatched: boolean
}

/**
 * Formats a number as USD currency
 */
function formatUSD(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount)
}

/**
 * Calculates all odds display values from a bet
 * @param bet - Bet with oddsBps and stake information
 * @returns Computed display values for odds UI
 */
export function calculateOddsDisplay(bet: Bet): OddsDisplay {
  // Parse collateral amounts using dynamic decimals
  const divisor = 10 ** COLLATERAL_DECIMALS
  const creatorStake = parseFloat(bet.creatorStake) / divisor

  // Handle oddsBps - default to 10000 (1.00x) if missing, zero, or invalid
  const oddsBps = bet.oddsBps > 0 ? bet.oddsBps : DEFAULT_ODDS_BPS
  if (bet.oddsBps < 0) {
    console.warn(`[calculateOddsDisplay] Invalid negative oddsBps (${bet.oddsBps}) for bet ${bet.betId}, defaulting to 1.00x`)
  }
  const oddsDecimal = oddsBps / 10000

  // Story 14-1: Single-filler model — compute required match from odds
  const requiredMatch = (creatorStake * oddsBps) / 10000
  const totalPot = creatorStake + requiredMatch

  // Single-filler: bet is either unmatched or fully matched
  const isMatched = !!bet.fillerAddress

  // Determine favorability for matcher
  let favorability: 'favorable' | 'even' | 'unfavorable'
  if (oddsDecimal > FAVORABLE_ODDS_THRESHOLD) {
    favorability = 'favorable'
  } else if (oddsDecimal < UNFAVORABLE_ODDS_THRESHOLD) {
    favorability = 'unfavorable'
  } else {
    favorability = 'even'
  }

  // Calculate return multipliers (protected against divide by zero and infinity)
  const creatorReturnRaw = creatorStake > 0 ? totalPot / creatorStake : 0
  const matcherReturnRaw = requiredMatch > 0 ? totalPot / requiredMatch : 0
  const creatorReturnVal = Number.isFinite(creatorReturnRaw) ? Math.min(creatorReturnRaw, 9999.99) : 0
  const matcherReturnVal = Number.isFinite(matcherReturnRaw) ? Math.min(matcherReturnRaw, 9999.99) : 0

  // Implied probability: P(creator wins) = odds / (odds + 1)
  const impliedProbability = oddsDecimal / (oddsDecimal + 1)

  return {
    decimal: oddsDecimal,
    display: `${oddsDecimal.toFixed(2)}x`,
    creatorRisk: formatUSD(creatorStake),
    matcherRisk: formatUSD(requiredMatch),
    totalPot: formatUSD(totalPot),
    creatorReturn: `${creatorReturnVal.toFixed(2)}x`,
    matcherReturn: `${matcherReturnVal.toFixed(2)}x`,
    impliedProbability,
    favorability,
    isMatched,
  }
}

/**
 * Formats implied probability as percentage string
 */
export function formatImpliedProbability(probability: number): string {
  return `${(probability * 100).toFixed(0)}%`
}

/**
 * Portfolio position with price information
 * Returned from GET /api/bets/:betId/portfolio
 */
export interface PortfolioPositionWithPrices {
  /** Market/condition ID */
  marketId: string
  /** Position: YES or NO */
  position: 'YES' | 'NO'
  /** Entry price when bet was placed (0-1) */
  startingPrice?: number
  /** Resolution price set by keeper (0-1) */
  endingPrice?: number
  /** Current live price (falls back to endingPrice if resolved) */
  currentPrice?: number
  /** Whether the market has resolved/closed */
  isClosed?: boolean
}

/**
 * Response from GET /api/bets/:betId/portfolio
 */
export interface PortfolioResponse {
  betId: string
  portfolioSize: number
  positions: PortfolioPositionWithPrices[]
  pagination: {
    page: number
    limit: number
    total: number
    hasMore: boolean
  }
}

/**
 * Calculate price change information for a position
 */
export function calculatePriceChange(position: PortfolioPositionWithPrices): {
  change: number | null
  changePercent: number | null
  direction: 'up' | 'down' | 'neutral' | null
} {
  if (position.startingPrice == null || position.currentPrice == null) {
    return { change: null, changePercent: null, direction: null }
  }

  const change = position.currentPrice - position.startingPrice
  const changePercent = position.startingPrice > 0
    ? (change / position.startingPrice) * 100
    : 0

  // For YES position: price up = good, For NO position: price down = good
  let direction: 'up' | 'down' | 'neutral'
  if (Math.abs(change) < 0.001) {
    direction = 'neutral'
  } else if (position.position === 'YES') {
    direction = change > 0 ? 'up' : 'down'
  } else {
    // NO position benefits from price going down
    direction = change < 0 ? 'up' : 'down'
  }

  return { change, changePercent, direction }
}

/**
 * Format price as percentage (0-1 -> 0-100%)
 */
export function formatPrice(price: number | null | undefined): string {
  if (price == null) return '—'
  return `${(price * 100).toFixed(1)}%`
}

/**
 * Format price change with sign
 */
export function formatPriceChange(change: number | null): string {
  if (change == null) return '—'
  const sign = change >= 0 ? '+' : ''
  return `${sign}${(change * 100).toFixed(1)}%`
}
