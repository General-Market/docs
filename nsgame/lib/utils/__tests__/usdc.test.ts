import { describe, expect, test } from 'bun:test'
import {
  compactUsdcBig,
  dollarsUsdcBig,
  formatUsdcBig,
  safeBigInt,
  signedUsdcBig,
} from '../usdc'

// Six-decimal SPL USDC. Display-side rounding is column-stable: every
// cell has the same width. Tests pin that contract so the next refactor
// cannot quietly bring back ragged decimals.

describe('formatUsdcBig — column-stable two decimals', () => {
  test('integer dollars', () => {
    expect(formatUsdcBig(0n)).toBe('0.00')
    expect(formatUsdcBig(1_000_000n)).toBe('1.00')
    expect(formatUsdcBig(1_500_000_000n)).toBe('1,500.00')
  })

  test('rounds excess decimals half-up', () => {
    // 1.985 → 1.99 — the bug that shipped to prod.
    expect(formatUsdcBig(1_985_000n)).toBe('1.99')
    expect(formatUsdcBig(1_984_999n)).toBe('1.98')
    expect(formatUsdcBig(1_985_001n)).toBe('1.99')
  })

  test('rounds large negatives correctly', () => {
    // -12,697.655 → -12,697.66
    expect(formatUsdcBig(-12_697_655_000n)).toBe('-12,697.66')
  })

  test('honours custom decimals option', () => {
    expect(formatUsdcBig(1_234_567n, { decimals: 4 })).toBe('1.2346')
    expect(formatUsdcBig(1_234_567n, { decimals: 0 })).toBe('1')
  })
})

describe('signedUsdcBig — sign + dollar', () => {
  test('positive carries plus and dollar', () => {
    expect(signedUsdcBig(1_985_000n)).toBe('+$1.99')
  })
  test('negative carries minus and dollar', () => {
    expect(signedUsdcBig(-3_000_000n)).toBe('-$3.00')
  })
  test('zero is plain dollar', () => {
    expect(signedUsdcBig(0n)).toBe('$0.00')
  })
})

describe('dollarsUsdcBig — unsigned dollar', () => {
  test('positive', () => {
    expect(dollarsUsdcBig(7_900_000n)).toBe('$7.90')
  })
  test('negative is rendered as positive amount', () => {
    expect(dollarsUsdcBig(-7_900_000n)).toBe('$7.90')
  })
  test('zero', () => {
    expect(dollarsUsdcBig(0n)).toBe('$0.00')
  })
})

describe('compactUsdcBig — short magnitude', () => {
  test('thousands', () => {
    expect(compactUsdcBig(32_443_700_000n)).toBe('$32.4K')
  })
  test('millions', () => {
    expect(compactUsdcBig(2_500_000_000_000n)).toBe('$2.5M')
  })
  test('sub-thousand keeps two decimals', () => {
    expect(compactUsdcBig(420_000n)).toBe('$0.42')
  })
  test('negative carries leading minus before dollar', () => {
    expect(compactUsdcBig(-32_443_700_000n)).toBe('-$32.4K')
  })
})

describe('safeBigInt', () => {
  test('null and empty default to zero', () => {
    expect(safeBigInt(null)).toBe(0n)
    expect(safeBigInt(undefined)).toBe(0n)
    expect(safeBigInt('')).toBe(0n)
  })
  test('valid string parses', () => {
    expect(safeBigInt('123456')).toBe(123_456n)
    expect(safeBigInt('-123456')).toBe(-123_456n)
  })
  test('invalid string returns zero', () => {
    expect(safeBigInt('not-a-number')).toBe(0n)
  })
})
