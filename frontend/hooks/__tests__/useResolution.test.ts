import { describe, test, expect } from 'bun:test'
import {
  formatWinRate,
  getWinRateColorClass,
  formatResolutionOutcome,
  type Resolution
} from '../useResolution'

describe('formatWinRate', () => {
  test('formats win/total with percentage', () => {
    expect(formatWinRate(7, 10)).toBe('7/10 (70%)')
  })

  test('formats perfect score', () => {
    expect(formatWinRate(10, 10)).toBe('10/10 (100%)')
  })

  test('formats zero wins', () => {
    expect(formatWinRate(0, 10)).toBe('0/10 (0%)')
  })

  test('returns N/A for zero total', () => {
    expect(formatWinRate(0, 0)).toBe('N/A')
  })

  test('handles odd fractions', () => {
    expect(formatWinRate(3, 7)).toBe('3/7 (43%)')
  })
})

describe('getWinRateColorClass', () => {
  test('returns green for > 60% win rate', () => {
    expect(getWinRateColorClass(7, 10)).toBe('text-green-500')
    expect(getWinRateColorClass(61, 100)).toBe('text-green-500')
  })

  test('returns yellow for 40-60% win rate', () => {
    expect(getWinRateColorClass(5, 10)).toBe('text-yellow-500')
    expect(getWinRateColorClass(45, 100)).toBe('text-yellow-500')
  })

  test('returns red for < 40% win rate', () => {
    expect(getWinRateColorClass(3, 10)).toBe('text-red-500')
    expect(getWinRateColorClass(39, 100)).toBe('text-red-500')
  })

  test('returns gray for zero total', () => {
    expect(getWinRateColorClass(0, 0)).toBe('text-gray-500')
  })
})

describe('formatResolutionOutcome', () => {
  test('formats tie state', () => {
    const resolution: Resolution = {
      betId: '1',
      winsCount: 5,
      validTrades: 10,
      winRate: 50,
      creatorWins: null,
      isTie: true,
      isCancelled: false,
      totalPot: '200',
      platformFee: '0.2',
      winnerPayout: '199.8',
      winnerAddress: null,
      loserAddress: null,
      settlementTxHash: null,
      status: 'tie'
    }
    expect(formatResolutionOutcome(resolution)).toBe('Tie - Both Refunded')
  })

  test('formats cancelled state with reason', () => {
    const resolution: Resolution = {
      betId: '1',
      winsCount: 0,
      validTrades: 0,
      winRate: 0,
      creatorWins: null,
      isTie: false,
      isCancelled: true,
      cancelReason: 'Insufficient valid trades',
      totalPot: '200',
      platformFee: '0',
      winnerPayout: '0',
      winnerAddress: null,
      loserAddress: null,
      settlementTxHash: null,
      status: 'cancelled'
    }
    expect(formatResolutionOutcome(resolution)).toBe('Cancelled - Insufficient valid trades')
  })

  test('formats cancelled state without reason', () => {
    const resolution: Resolution = {
      betId: '1',
      winsCount: 0,
      validTrades: 0,
      winRate: 0,
      creatorWins: null,
      isTie: false,
      isCancelled: true,
      totalPot: '0',
      platformFee: '0',
      winnerPayout: '0',
      winnerAddress: null,
      loserAddress: null,
      settlementTxHash: null,
      status: 'cancelled'
    }
    expect(formatResolutionOutcome(resolution)).toBe('Cancelled - Unknown reason')
  })

  test('formats creator wins', () => {
    const resolution: Resolution = {
      betId: '1',
      winsCount: 7,
      validTrades: 10,
      winRate: 70,
      creatorWins: true,
      isTie: false,
      isCancelled: false,
      totalPot: '200',
      platformFee: '0.2',
      winnerPayout: '199.8',
      winnerAddress: '0x1111111111111111111111111111111111111111',
      loserAddress: '0x2222222222222222222222222222222222222222',
      settlementTxHash: '0xabc',
      status: 'resolved'
    }
    expect(formatResolutionOutcome(resolution)).toBe('Creator Wins')
  })

  test('formats matcher wins', () => {
    const resolution: Resolution = {
      betId: '1',
      winsCount: 3,
      validTrades: 10,
      winRate: 30,
      creatorWins: false,
      isTie: false,
      isCancelled: false,
      totalPot: '200',
      platformFee: '0.2',
      winnerPayout: '199.8',
      winnerAddress: '0x2222222222222222222222222222222222222222',
      loserAddress: '0x1111111111111111111111111111111111111111',
      settlementTxHash: '0xabc',
      status: 'resolved'
    }
    expect(formatResolutionOutcome(resolution)).toBe('Matcher Wins')
  })

  test('formats pending state', () => {
    const resolution: Resolution = {
      betId: '1',
      winsCount: 0,
      validTrades: 0,
      winRate: 0,
      creatorWins: null,
      isTie: false,
      isCancelled: false,
      totalPot: '200',
      platformFee: '0',
      winnerPayout: '0',
      winnerAddress: null,
      loserAddress: null,
      settlementTxHash: null,
      status: 'pending'
    }
    expect(formatResolutionOutcome(resolution)).toBe('Pending')
  })
})
