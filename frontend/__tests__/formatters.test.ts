import { describe, test, expect } from 'bun:test'
import {
  formatWalletAddress,
  formatPortfolioSize,
  formatROI,
  formatWinRate,
  formatPnL,
  formatVolume,
  formatUSD,
  formatNumber,
  formatPercentage
} from '../lib/utils/formatters'

describe('formatWalletAddress', () => {
  test('truncates standard Ethereum address correctly', () => {
    expect(formatWalletAddress('0x742d35Cc6634C0532925a3b844Bc454e4438f44e'))
      .toBe('0x742d...f44e')
  })

  test('handles short addresses gracefully', () => {
    expect(formatWalletAddress('0x1234')).toBe('0x1234')
    expect(formatWalletAddress('')).toBe('')
  })

  test('handles null/undefined gracefully', () => {
    expect(formatWalletAddress(null as unknown as string)).toBeFalsy()
    expect(formatWalletAddress(undefined as unknown as string)).toBeFalsy()
  })
})

describe('formatPortfolioSize', () => {
  test('formats small numbers without K suffix', () => {
    expect(formatPortfolioSize(500)).toBe('500 markets')
    expect(formatPortfolioSize(999)).toBe('999 markets')
  })

  test('formats large numbers with K suffix', () => {
    expect(formatPortfolioSize(1000)).toBe('1.0K markets')
    expect(formatPortfolioSize(18500)).toBe('18.5K markets')
    expect(formatPortfolioSize(25000)).toBe('25.0K markets')
  })

  test('formats with correct decimal places', () => {
    expect(formatPortfolioSize(1234)).toBe('1.2K markets')
    expect(formatPortfolioSize(1250)).toBe('1.3K markets') // toFixed rounds .25 to .3
    expect(formatPortfolioSize(1260)).toBe('1.3K markets')
  })
})

describe('formatROI', () => {
  test('formats positive ROI with + sign', () => {
    expect(formatROI(156.3)).toBe('+156.3%')
    expect(formatROI(0)).toBe('+0.0%')
  })

  test('formats negative ROI with - sign', () => {
    expect(formatROI(-28.7)).toBe('-28.7%')
  })

  test('formats with one decimal place', () => {
    expect(formatROI(100.123)).toBe('+100.1%')
    expect(formatROI(-50.999)).toBe('-51.0%')
  })
})

describe('formatWinRate', () => {
  test('formats win rate as percentage', () => {
    expect(formatWinRate(73.5)).toBe('73.5%')
    expect(formatWinRate(100)).toBe('100.0%')
    expect(formatWinRate(0)).toBe('0.0%')
  })
})

describe('formatPnL', () => {
  test('formats positive P&L with + sign and dollar symbol', () => {
    expect(formatPnL(12567.89)).toBe('+$12,567.89')
    expect(formatPnL(0)).toBe('+$0.00')
  })

  test('formats negative P&L with - sign', () => {
    expect(formatPnL(-1234.56)).toBe('-$1,234.56')
  })

  test('includes thousand separators', () => {
    expect(formatPnL(1234567.89)).toBe('+$1,234,567.89')
  })
})

describe('formatVolume', () => {
  test('formats volume with dollar symbol', () => {
    expect(formatVolume(45678.90)).toBe('$45,678.90')
  })

  test('includes thousand separators', () => {
    expect(formatVolume(1234567.89)).toBe('$1,234,567.89')
  })
})

describe('formatUSD', () => {
  test('formats USDC amount (6 decimals) to USD string', () => {
    expect(formatUSD(1000000n)).toBe('$1.00')
    expect(formatUSD(12345678n)).toBe('$12.34')
    expect(formatUSD(1234567890n)).toBe('$1,234.56')
  })
})

describe('formatNumber', () => {
  test('formats numbers with commas', () => {
    expect(formatNumber(1234)).toBe('1,234')
    expect(formatNumber(1234567)).toBe('1,234,567')
  })
})

describe('formatPercentage', () => {
  test('formats decimal to percentage', () => {
    expect(formatPercentage(0.735)).toBe('73.5%')
    expect(formatPercentage(1)).toBe('100.0%')
    expect(formatPercentage(0.5, 0)).toBe('50%')
  })
})
