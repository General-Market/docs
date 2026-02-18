import { describe, test, expect } from 'bun:test'
import {
  formatUSD,
  formatNumber,
  formatPercentage,
  parseUSD,
  formatUsdcString,
  formatDate,
  formatResultWithPercent,
  formatAverageBetSize,
  formatBestWorstBet
} from '../formatters'

describe('formatUSD', () => {
  test('formats 100 USDC correctly', () => {
    // 100 USDC = 100_000_000 (6 decimals)
    expect(formatUSD(100_000_000n)).toBe('$100.00')
  })

  test('formats 1,234.56 USDC correctly', () => {
    expect(formatUSD(1_234_560_000n)).toBe('$1,234.56')
  })

  test('formats 0 USDC correctly', () => {
    expect(formatUSD(0n)).toBe('$0.00')
  })

  test('formats fractional amounts correctly', () => {
    // 0.50 USDC = 500_000
    expect(formatUSD(500_000n)).toBe('$0.50')
  })

  test('formats large amounts with commas', () => {
    // 1,000,000 USDC
    expect(formatUSD(1_000_000_000_000n)).toBe('$1,000,000.00')
  })
})

describe('formatNumber', () => {
  test('formats integer with commas', () => {
    expect(formatNumber(1234567)).toBe('1,234,567')
  })

  test('formats zero', () => {
    expect(formatNumber(0)).toBe('0')
  })

  test('formats small number without commas', () => {
    expect(formatNumber(999)).toBe('999')
  })
})

describe('formatPercentage', () => {
  test('formats decimal to percentage', () => {
    expect(formatPercentage(0.125)).toBe('12.5%')
  })

  test('formats 100% correctly', () => {
    expect(formatPercentage(1.0)).toBe('100.0%')
  })

  test('formats 0% correctly', () => {
    expect(formatPercentage(0)).toBe('0.0%')
  })

  test('respects decimal places parameter', () => {
    expect(formatPercentage(0.1234, 2)).toBe('12.34%')
  })
})

describe('parseUSD', () => {
  test('parses simple dollar amount', () => {
    expect(parseUSD('$100.00')).toBe(100_000_000n)
  })

  test('parses amount without dollar sign', () => {
    expect(parseUSD('100.50')).toBe(100_500_000n)
  })

  test('parses amount with commas', () => {
    expect(parseUSD('$1,234.56')).toBe(1_234_560_000n)
  })

  test('parses integer without decimals', () => {
    expect(parseUSD('100')).toBe(100_000_000n)
  })
})

describe('formatUsdcString', () => {
  test('formats API string amount correctly', () => {
    // API returns USDC amounts as strings like "199.800000"
    expect(formatUsdcString('199.800000')).toBe('$199.80')
  })

  test('formats whole number string', () => {
    expect(formatUsdcString('100.000000')).toBe('$100.00')
  })

  test('formats large amount with commas', () => {
    expect(formatUsdcString('1234567.890000')).toBe('$1,234,567.89')
  })

  test('returns $0.00 for null', () => {
    expect(formatUsdcString(null)).toBe('$0.00')
  })

  test('returns $0.00 for empty string', () => {
    expect(formatUsdcString('')).toBe('$0.00')
  })

  test('returns $0.00 for invalid string', () => {
    expect(formatUsdcString('not-a-number')).toBe('$0.00')
  })

  test('formats zero correctly', () => {
    expect(formatUsdcString('0.000000')).toBe('$0.00')
  })

  test('formats small fractional amounts', () => {
    expect(formatUsdcString('0.200000')).toBe('$0.20')
  })
})

describe('formatDate', () => {
  test('formats ISO date string correctly', () => {
    // Note: Result depends on locale, but should contain expected parts
    const result = formatDate('2026-01-20T12:30:00Z')
    expect(result).toContain('Jan')
    expect(result).toContain('20')
    expect(result).toContain('2026')
  })

  test('returns dash for empty string', () => {
    expect(formatDate('')).toBe('-')
  })

  test('returns dash for invalid date', () => {
    expect(formatDate('not-a-date')).toBe('-')
  })

  test('handles date with timezone offset', () => {
    const result = formatDate('2026-05-15T08:00:00-07:00')
    expect(result).toContain('May')
    expect(result).toContain('15')
  })
})

describe('formatResultWithPercent', () => {
  test('formats positive result correctly', () => {
    const result = formatResultWithPercent(24.50, 16.3)
    expect(result).toBe('+$24.50 (+16.3%)')
  })

  test('formats negative result correctly', () => {
    const result = formatResultWithPercent(-12.00, -8.5)
    expect(result).toBe('-$12.00 (-8.5%)')
  })

  test('formats zero result correctly', () => {
    const result = formatResultWithPercent(0, 0)
    expect(result).toBe('+$0.00 (+0.0%)')
  })

  test('formats large amounts with commas', () => {
    const result = formatResultWithPercent(1234.56, 45.2)
    expect(result).toBe('+$1,234.56 (+45.2%)')
  })

  test('handles mixed sign (positive amount, negative percent - edge case)', () => {
    // This is an edge case but should still format correctly
    const result = formatResultWithPercent(100, -5.0)
    expect(result).toBe('+$100.00 (-5.0%)')
  })
})

describe('formatAverageBetSize', () => {
  test('calculates and formats average correctly', () => {
    const result = formatAverageBetSize(45678.90, 234)
    expect(result).toBe('$195.21')
  })

  test('returns $0.00 for zero bets', () => {
    const result = formatAverageBetSize(1000, 0)
    expect(result).toBe('$0.00')
  })

  test('formats small average correctly', () => {
    const result = formatAverageBetSize(100, 10)
    expect(result).toBe('$10.00')
  })

  test('formats large average with commas', () => {
    const result = formatAverageBetSize(1000000, 100)
    expect(result).toBe('$10,000.00')
  })

  test('handles fractional average', () => {
    const result = formatAverageBetSize(100, 3)
    expect(result).toBe('$33.33')
  })
})

describe('formatBestWorstBet', () => {
  test('formats positive best bet correctly', () => {
    const result = formatBestWorstBet(500, 18000)
    expect(result).toBe('+$500.00 (18.0K markets)')
  })

  test('formats negative worst bet correctly', () => {
    const result = formatBestWorstBet(-250, 12000)
    expect(result).toBe('-$250.00 (12.0K markets)')
  })

  test('formats small portfolio size without K suffix', () => {
    const result = formatBestWorstBet(100, 500)
    expect(result).toBe('+$100.00 (500 markets)')
  })

  test('formats exactly 1000 with K suffix', () => {
    const result = formatBestWorstBet(200, 1000)
    expect(result).toBe('+$200.00 (1.0K markets)')
  })

  test('formats large amounts with commas', () => {
    const result = formatBestWorstBet(1234.56, 25000)
    expect(result).toBe('+$1,234.56 (25.0K markets)')
  })

  test('formats zero amount', () => {
    const result = formatBestWorstBet(0, 15000)
    expect(result).toBe('+$0.00 (15.0K markets)')
  })

  test('formats very large portfolio size', () => {
    const result = formatBestWorstBet(850, 100000)
    expect(result).toBe('+$850.00 (100.0K markets)')
  })
})
