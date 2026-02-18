import { describe, test, expect, mock, beforeEach } from 'bun:test'
import {
  getStatusDisplay,
  getStatusColor,
  isBetTerminal,
  formatWINDAmount,
  truncateAddress,
  canRequestArbitration,
  getResolutionTypeDisplay,
  type BilateralBet,
  type BilateralBetStatus,
} from '@/lib/types/bilateral-bet'

/**
 * Tests for Bilateral Bets Types and Utilities
 * Story 4-2, Task 8.2: Frontend component tests for bilateral bet display
 */

describe('bilateral-bet type helpers', () => {
  describe('getStatusDisplay', () => {
    test('returns correct display strings', () => {
      expect(getStatusDisplay('active')).toBe('Active')
      expect(getStatusDisplay('in_arbitration')).toBe('Disputed')
      expect(getStatusDisplay('settled')).toBe('Settled')
      expect(getStatusDisplay('custom_payout')).toBe('Settled (Custom)')
    })

    test('returns input for unknown status', () => {
      expect(getStatusDisplay('unknown' as BilateralBetStatus)).toBe('unknown')
    })
  })

  describe('getStatusColor', () => {
    test('returns correct color classes', () => {
      expect(getStatusColor('active')).toBe('text-green-400')
      expect(getStatusColor('in_arbitration')).toBe('text-orange-400')
      expect(getStatusColor('settled')).toBe('text-cyan-400')
      expect(getStatusColor('custom_payout')).toBe('text-purple-400')
    })

    test('returns default color for unknown status', () => {
      expect(getStatusColor('unknown' as BilateralBetStatus)).toBe('text-white/60')
    })
  })

  describe('isBetTerminal', () => {
    test('correctly identifies terminal states', () => {
      expect(isBetTerminal('active')).toBe(false)
      expect(isBetTerminal('in_arbitration')).toBe(false)
      expect(isBetTerminal('settled')).toBe(true)
      expect(isBetTerminal('custom_payout')).toBe(true)
    })
  })

  describe('getResolutionTypeDisplay', () => {
    test('returns correct display strings', () => {
      expect(getResolutionTypeDisplay('agreement')).toBe('Mutual Agreement')
      expect(getResolutionTypeDisplay('arbitration')).toBe('Keeper Arbitration')
      expect(getResolutionTypeDisplay('custom')).toBe('Custom Split')
      expect(getResolutionTypeDisplay(undefined)).toBe('Unknown')
    })
  })

  describe('formatWINDAmount', () => {
    test('formats amounts correctly', () => {
      expect(formatWINDAmount('100.123456789')).toBe('100.12')
      expect(formatWINDAmount('1000000')).toBe('1,000,000.00')
      expect(formatWINDAmount('0')).toBe('0.00')
    })

    test('handles invalid input', () => {
      expect(formatWINDAmount('invalid')).toBe('0.00')
      expect(formatWINDAmount('')).toBe('0.00')
    })

    test('respects decimal precision parameter', () => {
      expect(formatWINDAmount('100.123456', 4)).toBe('100.1235')
      expect(formatWINDAmount('100', 0)).toBe('100')
    })
  })

  describe('truncateAddress', () => {
    const address = '0x1234567890123456789012345678901234567890'

    test('truncates correctly with default chars', () => {
      expect(truncateAddress(address, 6)).toBe('0x123456...567890')
    })

    test('truncates correctly with custom chars', () => {
      expect(truncateAddress(address, 4)).toBe('0x1234...7890')
    })

    test('handles empty address', () => {
      expect(truncateAddress('', 6)).toBe('')
    })

    test('returns short address unchanged', () => {
      expect(truncateAddress('0x1234', 10)).toBe('0x1234')
    })
  })

  describe('canRequestArbitration', () => {
    const createBet = (status: BilateralBetStatus, deadlineOffset: number): BilateralBet => ({
      betId: 1,
      creator: '0x1234567890123456789012345678901234567890',
      filler: '0x0987654321098765432109876543210987654321',
      tradesRoot: '0xabc123',
      creatorAmount: '100',
      fillerAmount: '100',
      totalAmount: '200',
      deadline: new Date(Date.now() + deadlineOffset).toISOString(),
      status,
    })

    test('returns true for active bet with future deadline', () => {
      const bet = createBet('active', 86400000) // Tomorrow
      expect(canRequestArbitration(bet)).toBe(true)
    })

    test('returns false for settled bet', () => {
      const bet = createBet('settled', 86400000)
      expect(canRequestArbitration(bet)).toBe(false)
    })

    test('returns false for bet in arbitration', () => {
      const bet = createBet('in_arbitration', 86400000)
      expect(canRequestArbitration(bet)).toBe(false)
    })

    test('returns false for active bet with past deadline', () => {
      const bet = createBet('active', -86400000) // Yesterday
      expect(canRequestArbitration(bet)).toBe(false)
    })

    test('returns false for custom_payout bet', () => {
      const bet = createBet('custom_payout', 86400000)
      expect(canRequestArbitration(bet)).toBe(false)
    })
  })
})

describe('BilateralBet interface', () => {
  test('accepts valid status values', () => {
    const validStatuses: BilateralBetStatus[] = ['active', 'in_arbitration', 'settled', 'custom_payout']

    validStatuses.forEach(status => {
      const bet: BilateralBet = {
        betId: 1,
        creator: '0x1234567890123456789012345678901234567890',
        filler: '0x0987654321098765432109876543210987654321',
        tradesRoot: '0xabc123',
        creatorAmount: '100',
        fillerAmount: '100',
        totalAmount: '200',
        deadline: '2026-12-31T23:59:59Z',
        status,
      }
      expect(bet.status).toBe(status)
    })
  })

  test('accepts optional fields', () => {
    const bet: BilateralBet = {
      betId: 1,
      creator: '0x1234567890123456789012345678901234567890',
      filler: '0x0987654321098765432109876543210987654321',
      tradesRoot: '0xabc123',
      creatorAmount: '100',
      fillerAmount: '100',
      totalAmount: '200',
      deadline: '2026-12-31T23:59:59Z',
      status: 'settled',
      winner: '0x1234567890123456789012345678901234567890',
      creatorPayout: '150',
      fillerPayout: '50',
      resolutionType: 'arbitration',
      keeperCount: 3,
      committedAt: '2026-01-01T00:00:00Z',
      settledAt: '2026-01-02T00:00:00Z',
      blockNumber: 12345678,
      txHash: '0xfedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210',
    }

    expect(bet.winner).toBe('0x1234567890123456789012345678901234567890')
    expect(bet.resolutionType).toBe('arbitration')
    expect(bet.keeperCount).toBe(3)
    expect(bet.txHash).toBeDefined()
  })
})
