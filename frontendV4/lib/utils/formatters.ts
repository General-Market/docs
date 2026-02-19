/**
 * Utility functions for formatting display values
 */

import { COLLATERAL_DECIMALS } from '@/lib/contracts/addresses'

/**
 * Safely converts a string/number amount to BigInt base units.
 * Handles both integer strings ("1000000") and decimal strings ("0.010000").
 * @param value - Amount as string or number (may be decimal or integer)
 * @returns bigint in base units (6 decimals for USDC)
 */
export function toBaseUnits(value: string | number | undefined | null): bigint {
  if (value === undefined || value === null || value === '') {
    return BigInt(0)
  }

  const strValue = String(value)

  // If it's already an integer string (no decimal), convert directly
  if (!strValue.includes('.')) {
    try {
      return BigInt(strValue)
    } catch {
      return BigInt(0)
    }
  }

  // It's a decimal - convert to base units
  const floatValue = parseFloat(strValue)
  if (isNaN(floatValue)) {
    return BigInt(0)
  }
  return BigInt(Math.floor(floatValue * (10 ** COLLATERAL_DECIMALS)))
}

/**
 * Formats a USDC amount (6 decimals) to USD string
 * @param amount - The amount in USDC base units (6 decimals)
 * @returns Formatted string like "$1,234.56"
 */
export function formatUSD(amount: bigint): string {
  return `$${formatUsdcAmount(amount)}`
}

/**
 * Formats a USDC amount (6 decimals) to a number string without currency symbol
 * @param amount - The amount in USDC base units (6 decimals)
 * @returns Formatted string like "1,234.56"
 */
export function formatUsdcAmount(amount: bigint): string {
  const decimals = BigInt(COLLATERAL_DECIMALS)
  const divisor = 10n ** decimals

  // Get integer and fractional parts
  const integerPart = amount / divisor
  const fractionalPart = amount % divisor

  // Format with commas for thousands
  const integerStr = integerPart.toLocaleString('en-US')

  // Pad fractional part to 2 decimal places for display
  const fractionalStr = fractionalPart.toString().padStart(COLLATERAL_DECIMALS, '0').slice(0, 2)

  return `${integerStr}.${fractionalStr}`
}

/**
 * Formats a number with commas for thousands
 * @param num - The number to format
 * @returns Formatted string with commas (e.g., "1,234,567")
 */
export function formatNumber(num: number): string {
  if (typeof num !== 'number' || isNaN(num)) return '0'
  return num.toLocaleString('en-US')
}

/**
 * Formats a percentage value
 * @param value - The decimal value (0-1)
 * @param decimals - Number of decimal places (default 1)
 * @returns Formatted string like "12.5%"
 */
export function formatPercentage(value: number, decimals: number = 1): string {
  if (typeof value !== 'number' || isNaN(value)) return '0%'
  return `${(value * 100).toFixed(decimals)}%`
}

/**
 * Parses a USD string back to bigint (6 decimals)
 * @param usdString - String like "$100.50" or "100.50"
 * @returns bigint amount in USDC base units
 */
export function parseUSD(usdString: string): bigint {
  // Remove $ and commas
  const cleaned = usdString.replace(/[$,]/g, '')

  // Parse as decimal
  const parts = cleaned.split('.')
  const integerPart = parts[0] || '0'
  const fractionalPart = (parts[1] || '').padEnd(COLLATERAL_DECIMALS, '0').slice(0, COLLATERAL_DECIMALS)

  const multiplier = 10n ** BigInt(COLLATERAL_DECIMALS)
  return BigInt(integerPart) * multiplier + BigInt(fractionalPart)
}

/**
 * Truncates a wallet address to 0x1234...5678 format
 * @param address - Full wallet address
 * @returns Truncated address string
 */
export function formatWalletAddress(address: string): string {
  if (!address || address.length < 10) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

/**
 * Formats portfolio size with "K markets" suffix
 * @param num - Number of markets
 * @returns Formatted string like "18.5K markets" or "850 markets", or em dash if unavailable
 */
export function formatPortfolioSize(num: number): string {
  if (typeof num !== 'number' || isNaN(num) || num === 0) {
    return '\u2014'
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K markets`
  }
  return `${num.toLocaleString()} markets`
}

/**
 * Formats ROI as a percentage with sign
 * @param value - ROI as a percentage (e.g., 156.3 for 156.3%)
 * @returns Formatted string like "+156.3%" or "-28.7%"
 */
export function formatROI(value: number): string {
  if (typeof value !== 'number' || isNaN(value)) return '+0.0%'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

/**
 * Formats win rate as a percentage
 * @param value - Win rate as 0-100 percentage
 * @returns Formatted string like "73.5%"
 */
export function formatWinRate(value: number): string {
  if (typeof value !== 'number' || isNaN(value)) return '0.0%'
  return `${value.toFixed(1)}%`
}

/**
 * Formats P&L with USD symbol and sign
 * @param value - P&L amount in USD
 * @returns Formatted string like "+$12,567.89" or "-$1,234.56"
 */
export function formatPnL(value: number): string {
  if (typeof value !== 'number' || isNaN(value)) return '+$0.00'
  const sign = value >= 0 ? '+' : '-'
  const absValue = Math.abs(value)
  const formatted = absValue.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  return `${sign}$${formatted}`
}

/**
 * Formats volume with USD symbol
 * @param value - Volume amount in USD
 * @returns Formatted string like "$45,678.90"
 */
export function formatVolume(value: number): string {
  if (typeof value !== 'number' || isNaN(value)) return '$0.00'
  return `$${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

/**
 * Formats a USDC string amount (6 decimals as string) to display format
 * Used for API responses that return USDC amounts as strings like "199.800000"
 * @param amount - String like "199.800000" or null
 * @returns Formatted string like "$199.80"
 */
export function formatUsdcString(amount: string | null): string {
  if (!amount) return '$0.00'
  const num = parseFloat(amount)
  if (isNaN(num)) return '$0.00'
  return `$${num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/**
 * Formats an ISO date string for display in tooltips
 * @param isoString - ISO date string (e.g., "2026-01-20T12:30:00Z")
 * @returns Formatted date like "Jan 20, 2026"
 */
export function formatDate(isoString: string): string {
  if (!isoString) return '-'
  const date = new Date(isoString)
  if (isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

/**
 * Formats a result amount with percentage
 * @param amount - The result amount in USD
 * @param percent - The percentage return
 * @returns Formatted string like "+$24.50 (+16.3%)" or "-$12.00 (-8.5%)"
 */
export function formatResultWithPercent(amount: number, percent: number): string {
  const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0
  const safePercent = typeof percent === 'number' && !isNaN(percent) ? percent : 0
  const sign = safeAmount >= 0 ? '+' : '-'
  const absAmount = Math.abs(safeAmount)
  const formattedAmount = absAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })
  const percentSign = safePercent >= 0 ? '+' : ''
  return `${sign}$${formattedAmount} (${percentSign}${safePercent.toFixed(1)}%)`
}

/**
 * Formats average bet size from volume and total bets (AC3)
 * @param volume - Total volume in USD
 * @param totalBets - Number of bets
 * @returns Formatted string like "$245.50"
 */
export function formatAverageBetSize(volume: number, totalBets: number): string {
  if (totalBets === 0) return '$0.00'
  const avgSize = volume / totalBets
  return `$${avgSize.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`
}

/**
 * Formats best/worst bet with amount and portfolio size (AC3)
 * @param amount - P&L amount (positive or negative)
 * @param portfolioSize - Number of markets in portfolio
 * @returns Formatted string like "+$500.00 (18K markets)" or "-$250.00 (12K markets)"
 */
export function formatBestWorstBet(amount: number, portfolioSize: number): string {
  const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0
  const safeSize = typeof portfolioSize === 'number' && !isNaN(portfolioSize) ? portfolioSize : 0
  const sign = safeAmount >= 0 ? '+' : '-'
  const absAmount = Math.abs(safeAmount)
  const formattedAmount = absAmount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })

  // Format portfolio size
  let portfolioStr: string
  if (safeSize >= 1000) {
    portfolioStr = `${(safeSize / 1000).toFixed(1)}K`
  } else {
    portfolioStr = safeSize.toLocaleString()
  }

  return `${sign}$${formattedAmount} (${portfolioStr} markets)`
}
