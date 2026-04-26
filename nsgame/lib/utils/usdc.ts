// Solana-side USDC helpers. SPL USDC has 6 decimals. Six. Not eighteen.
// Every component formerly inlined this constant — we centralize it
// here so the next boundary mistake has only one place to live.

export const USDC_DECIMALS = 6

const BASE = 10n ** BigInt(USDC_DECIMALS)

/**
 * Format a 6-decimal USDC bigint to exactly `decimals` digits (default 2),
 * with banker-friendly half-up rounding on the trailing digit. The output
 * is column-stable: every cell in the same column has the same width.
 *
 * "12345.67". "1.99". "0.00". The fractional length never varies.
 */
export function formatUsdcBig(units: bigint, opts: { decimals?: number } = {}): string {
  const decimals = Math.min(USDC_DECIMALS, Math.max(0, opts.decimals ?? 2))
  const negative = units < 0n
  const abs = negative ? -units : units

  // Round to the requested number of decimals. Drop the digits beyond
  // `decimals`, half-up on the discarded part.
  const dropDigits = USDC_DECIMALS - decimals
  let scaled: bigint
  if (dropDigits === 0) {
    scaled = abs
  } else {
    const divisor = 10n ** BigInt(dropDigits)
    const quot = abs / divisor
    const rem = abs % divisor
    const halfUp = rem * 2n >= divisor ? 1n : 0n
    scaled = quot + halfUp
  }

  const factor = 10n ** BigInt(decimals)
  const whole = scaled / factor
  const frac = scaled % factor
  const wholeStr = whole.toLocaleString('en-US')
  const sign = negative && (whole !== 0n || frac !== 0n) ? '-' : ''

  if (decimals === 0) return `${sign}${wholeStr}`
  return `${sign}${wholeStr}.${frac.toString().padStart(decimals, '0')}`
}

/**
 * Parse a numeric string (possibly negative) to bigint. Empty / invalid
 * → 0n. Used to coerce on-the-wire string PnL values.
 */
export function safeBigInt(v: string | null | undefined): bigint {
  if (v == null || v === '') return 0n
  try { return BigInt(v) } catch { return 0n }
}

/**
 * Compact a 6-decimal USDC bigint into "$1.2K" / "$12M" / "$0.42" style.
 * For dense table cells where 7 digits ruin the column.
 */
export function compactUsdcBig(units: bigint): string {
  const negative = units < 0n
  const sign = negative ? '-' : ''
  const abs = negative ? -units : units
  const whole = Number(abs / BASE)
  if (whole >= 1_000_000) return `${sign}$${(whole / 1_000_000).toFixed(1)}M`
  if (whole >= 1_000) return `${sign}$${(whole / 1_000).toFixed(1)}K`
  // Sub-thousand: show two decimals so $0.42 doesn't render as $0.
  return `${sign}$${formatUsdcBig(abs, { decimals: 2 })}`
}

/**
 * Sign-bearing PnL string for cells. "+$12.34" / "-$5.00" / "$0.00".
 * The dollar lives next to the number, the sign before it. Currency
 * first, polarity outermost.
 */
export function signedUsdcBig(units: bigint): string {
  if (units > 0n) return `+$${formatUsdcBig(units)}`
  if (units < 0n) return `-$${formatUsdcBig(-units)}`
  return `$${formatUsdcBig(0n)}`
}

/**
 * Unsigned dollar amount. Use for stake / amount columns where the sign
 * is implicit. "$12.34" / "$0.00".
 */
export function dollarsUsdcBig(units: bigint): string {
  const abs = units < 0n ? -units : units
  return `$${formatUsdcBig(abs)}`
}

/** Relative time, in seconds-ago / minutes-ago form. */
export function relativeFromSecs(blockTime: number | null, nowSecs: number): string {
  if (blockTime === null) return '—'
  const diff = Math.max(0, nowSecs - blockTime)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

/** Short Solana-style address middle-ellipsis. */
export function shortAddress(addr: string | null | undefined): string {
  if (!addr) return '—'
  if (addr.length <= 9) return addr
  return `${addr.slice(0, 4)}…${addr.slice(-4)}`
}
