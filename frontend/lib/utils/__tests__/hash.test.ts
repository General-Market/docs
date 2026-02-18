import { describe, test, expect } from 'bun:test'
import { generateBetHash } from '../hash'

describe('generateBetHash', () => {
  test('generates valid hex hash', () => {
    const hash = generateBetHash('{"test": "data"}')
    expect(hash.startsWith('0x')).toBe(true)
    expect(hash.length).toBe(66) // 0x + 64 hex chars
  })

  test('generates consistent hash for same input', () => {
    const json = '{"positions": [{"marketId": "1", "position": "YES"}]}'
    const hash1 = generateBetHash(json)
    const hash2 = generateBetHash(json)
    expect(hash1).toBe(hash2)
  })

  test('generates different hash for different input', () => {
    const hash1 = generateBetHash('{"a": 1}')
    const hash2 = generateBetHash('{"a": 2}')
    expect(hash1).not.toBe(hash2)
  })

  test('handles empty string', () => {
    const hash = generateBetHash('')
    expect(hash.startsWith('0x')).toBe(true)
    expect(hash.length).toBe(66)
  })
})
