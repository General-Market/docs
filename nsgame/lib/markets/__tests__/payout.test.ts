import { describe, test, expect } from 'bun:test'
import { payoutMultiplier, isOneSided, FEE_BPS } from '../hooks'

describe('payoutMultiplier', () => {
  test('two-sided pool, A (yes) wins — applies 50bps fee', () => {
    // pool 100, fee = 0.005 * 200 = 1, net = 199, sidePool = 100 → 1.99
    const m = payoutMultiplier(100n, 100n, 'yes')
    expect(m).toBeCloseTo(1.99, 6)
  })

  test('two-sided pool, B (no) wins — applies 50bps fee', () => {
    // totals 60/40 (yes/no). winner = no, sidePool = 40
    // gross = 100, fee = 0.5, net = 99.5 → 99.5 / 40 = 2.4875
    const m = payoutMultiplier(60n, 40n, 'no')
    expect(m).toBeCloseTo(2.4875, 6)
  })

  test('one-sided pool — losing side returns null', () => {
    // only yes has stake; querying "no" multiplier is meaningless
    expect(payoutMultiplier(100n, 0n, 'no')).toBeNull()
  })

  test('one-sided pool — winning side multiplier still computes', () => {
    // The pure function is mechanical: fee is applied even one-sided.
    // The 1.0 refund path is the program's behaviour, expressed elsewhere
    // via `isOneSided`. Here we just assert the math.
    const m = payoutMultiplier(100n, 0n, 'yes')
    expect(m).toBeCloseTo(0.995, 6)
  })

  test('both pools zero — returns null', () => {
    expect(payoutMultiplier(0n, 0n, 'yes')).toBeNull()
    expect(payoutMultiplier(0n, 0n, 'no')).toBeNull()
  })

  test('fee constant is 50 basis points', () => {
    expect(FEE_BPS).toBe(50)
  })

  test('fee correctness — equal pools, multiplier ≈ 2 × (1 − 0.005)', () => {
    const m = payoutMultiplier(1_000_000n, 1_000_000n, 'yes') ?? 0
    expect(m).toBeCloseTo(2 * (1 - FEE_BPS / 10_000), 6)
  })
})

describe('isOneSided', () => {
  test('both zero is not one-sided', () => {
    expect(isOneSided(0n, 0n)).toBe(false)
  })
  test('only yes has stake', () => {
    expect(isOneSided(10n, 0n)).toBe(true)
  })
  test('only no has stake', () => {
    expect(isOneSided(0n, 10n)).toBe(true)
  })
  test('both sides have stake', () => {
    expect(isOneSided(1n, 1n)).toBe(false)
  })
})
