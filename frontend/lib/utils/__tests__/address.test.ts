import { describe, test, expect } from 'bun:test'
import { truncateAddress, isValidAddress } from '../address'

describe('isValidAddress', () => {
  test('returns true for valid Ethereum address', () => {
    expect(isValidAddress('0x1234567890123456789012345678901234567890')).toBe(true)
  })

  test('returns true for checksummed address', () => {
    expect(isValidAddress('0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B')).toBe(true)
  })

  test('returns false for empty string', () => {
    expect(isValidAddress('')).toBe(false)
  })

  test('returns false for address without 0x prefix', () => {
    expect(isValidAddress('1234567890123456789012345678901234567890')).toBe(false)
  })

  test('returns false for address with wrong length', () => {
    expect(isValidAddress('0x123456')).toBe(false)
    expect(isValidAddress('0x12345678901234567890123456789012345678901234')).toBe(false)
  })

  test('returns false for address with invalid characters', () => {
    expect(isValidAddress('0xGGGG567890123456789012345678901234567890')).toBe(false)
  })
})

describe('truncateAddress', () => {
  test('truncates valid address to 0x1234...5678 format', () => {
    const address = '0x1234567890123456789012345678901234567890'
    expect(truncateAddress(address)).toBe('0x1234...7890')
  })

  test('returns empty string for empty input', () => {
    expect(truncateAddress('')).toBe('')
  })

  test('returns original string for invalid address', () => {
    expect(truncateAddress('not-an-address')).toBe('not-an-address')
  })

  test('handles checksummed addresses', () => {
    const address = '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B'
    expect(truncateAddress(address)).toBe('0xAb58...eC9B')
  })
})
