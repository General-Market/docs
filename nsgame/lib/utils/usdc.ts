// Solana-side USDC helpers. SPL USDC has 6 decimals. Six. Not eighteen.
// Every component formerly inlined this constant — we centralize it
// here so the next boundary mistake has only one place to live.

export const USDC_DECIMALS = 6

const BASE = 10n ** BigInt(USDC_DECIMALS)

/**
 * Format a 6-decimal USDC bigint to a string like "12345.67". Strips
 * trailing zeros below 2 decimals; keeps at most 6.
 */
export function formatUsdcBig(units: bigint, opts: { decimals?: number } = {}): string {
  const minDec = opts.decimals ?? 2
  if (units === 0n) {
    return minDec === 0 ? '0' : `0.${'0'.repeat(minDec)}`
  }
  const negative = units < 0n
  const abs = negative ? -units : units
  const whole = abs / BASE
  const frac = abs % BASE
  const wholeStr = whole.toLocaleString('en-US')
  if (frac === 0n) {
    return `${negative ? '-' : ''}${wholeStr}${minDec > 0 ? '.' + '0'.repeat(minDec) : ''}`
  }
  let fracStr = frac.toString().padStart(USDC_DECIMALS, '0')
  // Trim trailing zeros, but keep at least minDec digits.
  while (fracStr.length > minDec && fracStr.endsWith('0')) {
    fracStr = fracStr.slice(0, -1)
  }
  return `${negative ? '-' : ''}${wholeStr}.${fracStr}`
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
 * Sign-bearing PnL string for use directly inside cells. "+12.34" / "-5.00".
 */
export function signedUsdcBig(units: bigint): string {
  if (units > 0n) return `+${formatUsdcBig(units)}`
  if (units < 0n) return formatUsdcBig(units)
  return formatUsdcBig(0n)
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
