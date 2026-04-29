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

  test('falls back to weight-based math when inventory entry is missing', () => {
    // Legacy ITP with no on-chain inventory: every holding falls through to
    // weight × fillAmount / price. Approx flag flips to true.
    const out = computeFillBreakdown({
      fillAmount: 10n * ONE,  // 10 USDC
      fillPrice: ONE,         // $1 per share
      holdings: [
        { symbol: 'A', address: '0xa', price: 2, weight: 0.6 },
        { symbol: 'B', address: '0xb', price: 5, weight: 0.4 },
      ],
      inventory: [],
    })
    expect(out).toHaveLength(2)
    // A: 10 * 0.6 / 2 = 3 units, $6
    expect(out[0]).toMatchObject({ symbol: 'A', qtyAcquired: 3, usd: 6, isApprox: true })
    // B: 10 * 0.4 / 5 = 0.8 units, $4
    expect(out[1]).toMatchObject({ symbol: 'B', qtyAcquired: 0.8, usd: 4, isApprox: true })
  })

  test('mixes exact and approx rows when inventory partially covers holdings', () => {
    const out = computeFillBreakdown({
      fillAmount: 10n * ONE,
      fillPrice: ONE,
      holdings: [
        { symbol: 'A', address: '0xa', price: 1, weight: 0.5 },
        { symbol: 'B', address: '0xb', price: 1, weight: 0.5 },
      ],
      inventory: [{ address: '0xa', qtyPerShare: ONE / 2n }],
    })
    expect(out.map(r => r.symbol)).toEqual(['A', 'B'])
    expect(out[0].isApprox).toBe(false)
    expect(out[1].isApprox).toBe(true)
  })

  test('keeps qty=0 when both inventory missing and price is 0', () => {
    const out = computeFillBreakdown({
      fillAmount: 10n * ONE,
      fillPrice: ONE,
      holdings: [{ symbol: 'X', address: '0xa', price: 0, weight: 0.5 }],
      inventory: [],
    })
    expect(out[0].qtyAcquired).toBe(0)
    expect(out[0].usd).toBeNull()
    expect(out[0].isApprox).toBe(true)
  })
})
