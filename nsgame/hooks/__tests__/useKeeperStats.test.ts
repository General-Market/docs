import { describe, test, expect } from 'bun:test'
import { formatAccuracyRate } from '../useKeeperStats'

describe('formatAccuracyRate', () => {
  test('formats 100% correctly', () => {
    expect(formatAccuracyRate(1.0)).toBe('100.0%')
  })

  test('formats 0% correctly', () => {
    expect(formatAccuracyRate(0)).toBe('0.0%')
  })

  test('formats typical accuracy rate', () => {
    expect(formatAccuracyRate(0.952)).toBe('95.2%')
  })

  test('formats low accuracy rate', () => {
    expect(formatAccuracyRate(0.12)).toBe('12.0%')
  })

  test('formats with single decimal precision', () => {
    expect(formatAccuracyRate(0.9876)).toBe('98.8%')
  })
})
