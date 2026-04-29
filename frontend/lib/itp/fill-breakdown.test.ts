import { describe, test, expect } from 'bun:test'
import { computeFillBreakdown } from './fill-breakdown'

const ONE = 10n ** 18n

describe('computeFillBreakdown', () => {
  test('returns empty when fillPrice is zero', () => {
    expect(
      computeFillBreakdown({
        fillAmount: 100n * ONE,
        fillPrice: 0n,
        holdings: [{ symbol: 'AAPL', address: '0xa', price: 100, weight: 0.5 }],
        inventory: [{ address: '0xa', qtyPerShare: ONE / 100n }],
      }),
    ).toEqual([])
  })

  test('computes exact qty for an equal-weight 2-asset basket at NAV $1', () => {
    const half = ONE / 2n
    const out = computeFillBreakdown({
      fillAmount: 10n * ONE,
      fillPrice: ONE,
      holdings: [
        { symbol: 'AAPL', address: '0xa', price: 1, weight: 0.5 },
        { symbol: 'BTC', address: '0xb', price: 1, weight: 0.5 },
      ],
      inventory: [
        { address: '0xa', qtyPerShare: half },
        { address: '0xB', qtyPerShare: half }, // case-insensitive join
      ],
    })
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ symbol: 'AAPL', qtyAcquired: 5, usd: 5 })
    expect(out[1]).toMatchObject({ symbol: 'BTC', qtyAcquired: 5, usd: 5 })
  })

  test('returns null usd when price is missing but keeps qty', () => {
    const out = computeFillBreakdown({
      fillAmount: 10n * ONE,
      fillPrice: ONE,
      holdings: [{ symbol: 'X', address: '0xa', price: 0, weight: 1 }],
      inventory: [{ address: '0xa', qtyPerShare: ONE }],
    })
    expect(out[0].qtyAcquired).toBe(10)
    expect(out[0].usd).toBeNull()
  })

  test('skips holdings with no matching inventory entry', () => {
    const out = computeFillBreakdown({
      fillAmount: ONE,
      fillPrice: ONE,
      holdings: [
        { symbol: 'A', address: '0xa', price: 1, weight: 1 },
        { symbol: 'B', address: '0xb', price: 1, weight: 0 },
      ],
      inventory: [{ address: '0xa', qtyPerShare: ONE }],
    })
    expect(out.map(h => h.symbol)).toEqual(['A'])
  })
})
