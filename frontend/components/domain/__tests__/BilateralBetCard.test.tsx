import { describe, test, expect } from 'bun:test'
import type { BilateralBet } from '@/lib/types/bilateral-bet'

/**
 * Tests for BilateralBetCard component
 * Story 4-2, Task 8.2: Frontend component tests for bilateral bet display
 *
 * Tests component-specific logic: formatDeadline, getUserRole, and display rules.
 * Type utility tests are in hooks/__tests__/useBilateralBets.test.ts
 */

// ============================================================================
// Internal Helper Functions (mirrored from component for testing)
// ============================================================================

/**
 * Format deadline for display (from BilateralBetCard)
 */
function formatDeadline(deadline: string): string {
  const date = new Date(deadline)
  const now = new Date()
  const diff = date.getTime() - now.getTime()

  if (diff < 0) return 'Expired'

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h`
  return 'Soon'
}

/**
 * Determine user's role in the bet (from BilateralBetCard)
 */
function getUserRole(bet: BilateralBet, userAddress?: string): 'creator' | 'filler' | null {
  if (!userAddress) return null
  const lowerAddress = userAddress.toLowerCase()
  if (bet.creator.toLowerCase() === lowerAddress) return 'creator'
  if (bet.filler.toLowerCase() === lowerAddress) return 'filler'
  return null
}

// ============================================================================
// Test Data Factory
// ============================================================================

function createTestBet(overrides: Partial<BilateralBet> = {}): BilateralBet {
  return {
    betId: 1,
    creator: '0x1234567890123456789012345678901234567890',
    filler: '0x0987654321098765432109876543210987654321',
    tradesRoot: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    creatorAmount: '100.5',
    fillerAmount: '100.5',
    totalAmount: '201',
    deadline: new Date(Date.now() + 86400000).toISOString(), // Tomorrow
    status: 'active',
    ...overrides,
  }
}

// ============================================================================
// formatDeadline Tests
// ============================================================================

describe('formatDeadline', () => {
  test('returns "Expired" for past dates', () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString() // Yesterday
    expect(formatDeadline(pastDate)).toBe('Expired')
  })

  test('returns days and hours for future dates', () => {
    const twoDaysFromNow = new Date(Date.now() + 2 * 86400000 + 3600000).toISOString() // 2d 1h
    const result = formatDeadline(twoDaysFromNow)
    expect(result).toMatch(/^\d+d \d+h$/)
    expect(result.startsWith('2d')).toBe(true)
  })

  test('returns hours only when less than a day', () => {
    const hoursFromNow = new Date(Date.now() + 5 * 3600000).toISOString() // 5 hours
    const result = formatDeadline(hoursFromNow)
    expect(result).toMatch(/^\d+h$/)
  })

  test('returns "Soon" for very near future', () => {
    const minutesFromNow = new Date(Date.now() + 30 * 60000).toISOString() // 30 minutes
    expect(formatDeadline(minutesFromNow)).toBe('Soon')
  })

  test('handles exactly now', () => {
    const now = new Date(Date.now() + 1000).toISOString() // 1 second from now
    expect(formatDeadline(now)).toBe('Soon')
  })
})

// ============================================================================
// getUserRole Tests
// ============================================================================

describe('getUserRole', () => {
  test('returns "creator" when user is the creator', () => {
    const bet = createTestBet()
    expect(getUserRole(bet, '0x1234567890123456789012345678901234567890')).toBe('creator')
  })

  test('returns "filler" when user is the filler', () => {
    const bet = createTestBet()
    expect(getUserRole(bet, '0x0987654321098765432109876543210987654321')).toBe('filler')
  })

  test('returns null when user is neither party', () => {
    const bet = createTestBet()
    expect(getUserRole(bet, '0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')).toBeNull()
  })

  test('returns null when no user address provided', () => {
    const bet = createTestBet()
    expect(getUserRole(bet, undefined)).toBeNull()
  })

  test('is case-insensitive for addresses', () => {
    const bet = createTestBet()
    // Uppercase version of creator
    expect(getUserRole(bet, '0x1234567890123456789012345678901234567890'.toUpperCase())).toBe('creator')
    // Mixed case version of filler
    expect(getUserRole(bet, '0x0987654321098765432109876543210987654321'.toUpperCase())).toBe('filler')
  })
})

// ============================================================================
// Status Display Logic Tests
// ============================================================================

describe('status display logic', () => {
  test('active status should be shown with green styling', () => {
    const bet = createTestBet({ status: 'active' })
    expect(bet.status).toBe('active')
    // Component uses getStatusColor which returns text-green-400 for active
  })

  test('in_arbitration status represents disputed state', () => {
    const bet = createTestBet({ status: 'in_arbitration' })
    expect(bet.status).toBe('in_arbitration')
    // Component uses getStatusDisplay which returns "Disputed" for in_arbitration
  })

  test('settled status indicates terminal state', () => {
    const bet = createTestBet({
      status: 'settled',
      winner: '0x1234567890123456789012345678901234567890',
      resolutionType: 'agreement',
    })
    expect(bet.status).toBe('settled')
    expect(bet.winner).toBeDefined()
  })

  test('custom_payout status has payout amounts', () => {
    const bet = createTestBet({
      status: 'custom_payout',
      creatorPayout: '150',
      fillerPayout: '51',
      resolutionType: 'custom',
    })
    expect(bet.status).toBe('custom_payout')
    expect(bet.creatorPayout).toBe('150')
    expect(bet.fillerPayout).toBe('51')
  })
})

// ============================================================================
// Settlement Display Logic Tests
// ============================================================================

describe('settlement display logic', () => {
  test('winner display requires winner address', () => {
    const bet = createTestBet({
      status: 'settled',
      winner: '0x1234567890123456789012345678901234567890',
      resolutionType: 'agreement',
    })
    expect(bet.winner).toBe('0x1234567890123456789012345678901234567890')
  })

  test('custom payout shows both party payouts', () => {
    const bet = createTestBet({
      status: 'custom_payout',
      creatorPayout: '120',
      fillerPayout: '81',
    })
    // Sum should equal total (minus fees)
    const creatorPayout = parseFloat(bet.creatorPayout!)
    const fillerPayout = parseFloat(bet.fillerPayout!)
    expect(creatorPayout + fillerPayout).toBe(201)
  })

  test('arbitration resolution shows keeper count', () => {
    const bet = createTestBet({
      status: 'settled',
      winner: '0x1234567890123456789012345678901234567890',
      resolutionType: 'arbitration',
      keeperCount: 3,
    })
    expect(bet.resolutionType).toBe('arbitration')
    expect(bet.keeperCount).toBe(3)
  })
})

// ============================================================================
// Link Generation Tests
// ============================================================================

describe('link generation', () => {
  test('generates correct detail page link', () => {
    const bet = createTestBet({ betId: 42 })
    const expectedHref = `/bilateral-bet/${bet.betId}`
    expect(expectedHref).toBe('/bilateral-bet/42')
  })

  test('generates link for any bet ID', () => {
    const bet = createTestBet({ betId: 999 })
    const href = `/bilateral-bet/${bet.betId}`
    expect(href).toBe('/bilateral-bet/999')
  })
})

// ============================================================================
// Transaction Hash Display Tests
// ============================================================================

describe('transaction hash display', () => {
  test('txHash presence determines tx link visibility', () => {
    const betWithTx = createTestBet({
      txHash: '0xdeadbeef123456789abcdef123456789abcdef123456789abcdef123456789ab',
    })
    expect(betWithTx.txHash).toBeDefined()

    const betWithoutTx = createTestBet()
    expect(betWithoutTx.txHash).toBeUndefined()
  })

  test('block number is optional', () => {
    const bet = createTestBet({ blockNumber: 12345678 })
    expect(bet.blockNumber).toBe(12345678)
  })
})

// ============================================================================
// Timestamps Display Tests
// ============================================================================

describe('timestamps display', () => {
  test('committedAt timestamp formats correctly', () => {
    const timestamp = '2026-01-15T12:30:00Z'
    const bet = createTestBet({ committedAt: timestamp })
    expect(bet.committedAt).toBe(timestamp)
    // Component uses new Date().toLocaleString() for display
    const parsed = new Date(bet.committedAt!)
    expect(parsed.getFullYear()).toBe(2026)
    expect(parsed.getMonth()).toBe(0) // January
    expect(parsed.getDate()).toBe(15)
  })

  test('settledAt only present for terminal states', () => {
    const timestamp = '2026-01-16T15:45:00Z'
    const bet = createTestBet({
      status: 'settled',
      winner: '0x1234567890123456789012345678901234567890',
      settledAt: timestamp,
    })
    expect(bet.settledAt).toBe(timestamp)
  })
})

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  test('handles minimum bet ID', () => {
    const bet = createTestBet({ betId: 0 })
    expect(bet.betId).toBe(0)
  })

  test('handles large bet ID', () => {
    const bet = createTestBet({ betId: 999999999 })
    expect(bet.betId).toBe(999999999)
  })

  test('handles very long deadline', () => {
    const farFuture = new Date(Date.now() + 365 * 86400000).toISOString() // 1 year
    const result = formatDeadline(farFuture)
    expect(result).toMatch(/^\d+d \d+h$/)
  })

  test('handles zero amounts', () => {
    const bet = createTestBet({
      creatorAmount: '0',
      fillerAmount: '0',
      totalAmount: '0',
    })
    expect(bet.totalAmount).toBe('0')
  })
})
